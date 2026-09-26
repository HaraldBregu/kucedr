import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

type Params = Record<string, unknown>;
type Pending = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
};

export class CodexRpc {
	private readonly process: ChildProcessWithoutNullStreams;
	private readonly pending = new Map<number, Pending>();
	private sequence = 0;
	private failure?: Error;
	private stderr = '';
	onNotification?: (method: string, params: Params) => void;
	onRequest?: (method: string, params: Params) => Promise<unknown>;
	onClose?: (error: Error) => void;

	constructor(executable: string, directory: string) {
		this.process = spawn(
			executable,
			[
				'app-server',
				'-c',
				'cli_auth_credentials_store="file"',
				'-c',
				`sqlite_home=${JSON.stringify(directory)}`,
				'-c',
				`log_dir=${JSON.stringify(directory)}`,
			],
			{
				cwd: directory,
				env: { ...process.env, CODEX_HOME: directory },
				stdio: 'pipe',
				windowsHide: true,
			}
		);
		this.process.stderr.on('data', (data: Buffer) => {
			this.stderr = (this.stderr + data.toString()).slice(-4000);
		});
		this.process.on('error', (error) => this.fail(error));
		this.process.stdin.on('error', (error) => this.fail(error));
		this.process.on('exit', (code) =>
			this.fail(new Error(`Codex exited (${code ?? 'signal'}). ${this.stderr.trim()}`))
		);
		createInterface({ input: this.process.stdout }).on('line', (line) => this.receive(line));
	}

	async initialize(): Promise<void> {
		await this.request('initialize', {
			clientInfo: { name: 'kucedr_coder', title: 'Kucedr Coder', version: '1.0.0' },
		});
		this.write({ method: 'initialized', params: {} });
	}

	request<T = unknown>(method: string, params: Params): Promise<T> {
		if (this.failure) return Promise.reject(this.failure);
		const id = ++this.sequence;
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`Codex request timed out: ${method}`));
			}, 60_000);
			this.pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
			this.write({ id, method, params });
		});
	}

	close(): void {
		this.fail(new Error('Codex connection closed.'));
		if (this.process.exitCode !== null) return;
		this.process.kill();
		const timer = setTimeout(() => {
			if (this.process.exitCode === null) this.process.kill('SIGKILL');
		}, 2000);
		timer.unref();
		this.process.once('exit', () => clearTimeout(timer));
	}

	private write(message: unknown): void {
		if (!this.failure) this.process.stdin.write(`${JSON.stringify(message)}\n`);
	}

	private fail(error: Error): void {
		if (this.failure) return;
		this.failure = error;
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(error);
		}
		this.pending.clear();
		this.onClose?.(error);
	}

	private receive(line: string): void {
		let message: {
			id?: number | string;
			method?: string;
			params?: Params;
			result?: unknown;
			error?: { message: string };
		};
		try {
			message = JSON.parse(line);
		} catch {
			this.fail(new Error('Codex sent invalid protocol data.'));
			return;
		}
		if (message.method) {
			if (message.id !== undefined) {
				const request = this.onRequest
					? this.onRequest(message.method, message.params ?? {})
					: Promise.reject(new Error('Unsupported Codex request.'));
				void request.then(
					(result) => this.write({ id: message.id, result }),
					(error: unknown) =>
						this.write({
							id: message.id,
							error: {
								code: -32603,
								message: error instanceof Error ? error.message : 'Request failed.',
							},
						})
				);
			} else this.onNotification?.(message.method, message.params ?? {});
			return;
		}
		const pending = typeof message.id === 'number' ? this.pending.get(message.id) : undefined;
		if (!pending) return;
		this.pending.delete(message.id as number);
		clearTimeout(pending.timer);
		if (message.error) pending.reject(new Error(message.error.message));
		else pending.resolve(message.result);
	}
}
