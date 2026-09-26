import { spawn } from 'node:child_process';
import type { HarnessContext } from './harness/types';

export function executeCommand(command: string, context: HarnessContext): Promise<string> {
	context.signal.throwIfAborted();
	context.emit({ type: 'command-start', command });
	return new Promise((resolve, reject) => {
		const windows = process.platform === 'win32';
		const child = spawn(
			windows ? process.env.ComSpec || 'cmd.exe' : process.env.SHELL || '/bin/sh',
			windows ? ['/d', '/s', '/c', command] : ['-lc', command],
			{ cwd: context.cwd, env: process.env, detached: !windows, stdio: ['ignore', 'pipe', 'pipe'] }
		);
		let output = '';
		let truncated = false;
		const abort = (): void => {
			try {
				if (!windows && child.pid) process.kill(-child.pid, 'SIGKILL');
				else child.kill('SIGKILL');
			} catch {
				child.kill('SIGKILL');
			}
		};
		context.signal.addEventListener('abort', abort, { once: true });
		const receive = (chunk: Buffer): void => {
			const text = chunk.toString('utf8');
			const allowed = text.slice(0, Math.max(0, 1024 * 1024 - output.length));
			if (allowed) {
				output += allowed;
				context.emit({ type: 'command-output', delta: allowed });
			}
			if (allowed.length < text.length) truncated = true;
		};
		child.stdout.on('data', receive);
		child.stderr.on('data', receive);
		child.once('error', (error) => {
			context.signal.removeEventListener('abort', abort);
			reject(error);
		});
		child.once('close', (code) => {
			context.signal.removeEventListener('abort', abort);
			context.emit({
				type: 'command-end',
				exitCode: code ?? undefined,
				cancelled: context.signal.aborted,
				truncated,
			});
			if (context.signal.aborted) reject(new Error('Coder run cancelled.'));
			else resolve(output);
		});
	});
}
