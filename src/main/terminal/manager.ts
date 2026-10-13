import type { WebContents } from 'electron';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawn, type IPty, type IPtyForkOptions, type IWindowsPtyForkOptions } from 'node-pty';
import { TerminalChannels } from '../../shared/ipc_channels_definitions';
import type {
	TerminalCreateRequest,
	TerminalDataEvent,
	TerminalExitEvent,
	TerminalSessionInfo,
} from '../../shared/terminal';
import type { LoggerService } from '../shared';
import type { EnvironmentManager } from './environment';
import type { TerminalSession } from './session';
import type { ShellDetector } from './shell';

export type PtySpawn = (
	file: string,
	args: string[],
	options: IPtyForkOptions | IWindowsPtyForkOptions
) => IPty;

export class PtyManager {
	private readonly sessions = new Map<string, TerminalSession>();
	private readonly pendingIds = new Set<string>();
	private readonly ownerCleanup = new Map<number, () => void>();

	constructor(
		private readonly logger: Pick<LoggerService, 'info' | 'warn' | 'error'>,
		private readonly shellDetector: ShellDetector,
		private readonly environmentManager: EnvironmentManager,
		private readonly spawnPty: PtySpawn = spawn
	) {}

	get count(): number {
		return this.sessions.size;
	}

	async create(owner: WebContents, request: TerminalCreateRequest): Promise<TerminalSessionInfo> {
		if (this.sessions.has(request.id) || this.pendingIds.has(request.id)) {
			throw new Error(`Terminal session already exists: ${request.id}`);
		}
		this.pendingIds.add(request.id);

		try {
			const detectedShell = this.shellDetector.detect();
			const environment = await this.environmentManager.get(detectedShell.executable);
			if (owner.isDestroyed()) throw new Error('The terminal window is no longer available.');
			const cwd = this.resolveCwd(request.cwd);
			let process: IPty;
			try {
				process = this.spawnPty(detectedShell.executable, detectedShell.args, {
					name: 'xterm-256color',
					cols: request.cols,
					rows: request.rows,
					cwd,
					env: environment,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Unable to start ${detectedShell.executable}: ${message}`, { cause: error });
			}

			const createdAt = Date.now();
			const session = {} as TerminalSession;
			Object.assign(session, {
				id: request.id,
				shell: detectedShell.executable,
				args: detectedShell.args,
				cwd,
				cols: request.cols,
				rows: request.rows,
				process,
				createdAt,
				exited: false,
				owner,
				dataSubscription: process.onData((data) => this.sendData(session, data)),
			});
			session.exitSubscription = process.onExit((event) => this.handleExit(session, event));

			this.sessions.set(session.id, session);
			this.trackOwner(owner);
			this.logger.info('PtyManager', `Started terminal ${session.id}`, {
				shell: session.shell,
				cwd: session.cwd,
				pid: session.process.pid,
			});

			return {
				id: session.id,
				shell: session.shell,
				cwd: session.cwd,
				cols: session.cols,
				rows: session.rows,
				createdAt: session.createdAt,
			};
		} finally {
			this.pendingIds.delete(request.id);
		}
	}

	write(ownerId: number, id: string, data: string): boolean {
		const session = this.ownedSession(ownerId, id);
		if (!session || session.exited) return false;
		session.process.write(data);
		return true;
	}

	resize(ownerId: number, id: string, cols: number, rows: number): boolean {
		const session = this.ownedSession(ownerId, id);
		if (!session || session.exited) return false;
		if (session.cols === cols && session.rows === rows) return true;
		session.process.resize(cols, rows);
		session.cols = cols;
		session.rows = rows;
		return true;
	}

	kill(ownerId: number, id: string): boolean {
		const session = this.ownedSession(ownerId, id);
		if (!session) return false;
		this.remove(session);
		try {
			session.process.kill();
		} catch (error) {
			this.logger.warn('PtyManager', `Failed to terminate terminal ${id}`, error);
		}
		return true;
	}

	killOwner(ownerId: number): void {
		for (const session of [...this.sessions.values()]) {
			if (session.owner.id === ownerId) this.kill(ownerId, session.id);
		}
	}

	shutdown(): void {
		for (const session of [...this.sessions.values()]) {
			this.kill(session.owner.id, session.id);
		}
	}

	private ownedSession(ownerId: number, id: string): TerminalSession | undefined {
		const session = this.sessions.get(id);
		if (session && session.owner.id !== ownerId) {
			throw new Error('Terminal session is owned by another window.');
		}
		return session;
	}

	private resolveCwd(requested?: string): string {
		const cwd = requested ?? homedir();
		if (!path.isAbsolute(cwd)) throw new Error('Terminal working directory must be absolute.');
		try {
			if (!statSync(cwd).isDirectory()) throw new Error('Path is not a directory.');
		} catch {
			throw new Error(`Terminal working directory is unavailable: ${cwd}`);
		}
		return cwd;
	}

	private sendData(session: TerminalSession, data: string): void {
		if (!this.sessions.has(session.id) || session.owner.isDestroyed()) return;
		try {
			const event: TerminalDataEvent = { id: session.id, data };
			session.owner.send(TerminalChannels.data, event);
		} catch (error) {
			this.logger.warn('PtyManager', `Unable to deliver output for terminal ${session.id}`, error);
		}
	}

	private handleExit(
		session: TerminalSession,
		event: { readonly exitCode: number; readonly signal?: number }
	): void {
		if (!this.sessions.has(session.id)) return;
		if (!session.owner.isDestroyed()) {
			try {
				const payload: TerminalExitEvent = { id: session.id, ...event };
				session.owner.send(TerminalChannels.exit, payload);
			} catch (error) {
				this.logger.warn('PtyManager', `Unable to deliver exit for terminal ${session.id}`, error);
			}
		}
		this.remove(session);
		this.logger.info('PtyManager', `Terminal ${session.id} exited`, event);
	}

	private remove(session: TerminalSession): void {
		session.exited = true;
		this.sessions.delete(session.id);
		session.dataSubscription.dispose();
		session.exitSubscription?.dispose();
		this.untrackOwner(session.owner.id);
	}

	private trackOwner(owner: WebContents): void {
		if (this.ownerCleanup.has(owner.id)) return;
		const onDestroyed = (): void => this.killOwner(owner.id);
		const onRenderProcessGone = (): void => this.killOwner(owner.id);
		const onNavigation = (
			_event: Electron.Event,
			_url: string,
			_isSameDocument: boolean,
			isMainFrame: boolean
		): void => {
			if (isMainFrame) this.killOwner(owner.id);
		};
		owner.once('destroyed', onDestroyed);
		owner.on('render-process-gone', onRenderProcessGone);
		owner.on('did-start-navigation', onNavigation);
		this.ownerCleanup.set(owner.id, () => {
			owner.removeListener('destroyed', onDestroyed);
			owner.removeListener('render-process-gone', onRenderProcessGone);
			owner.removeListener('did-start-navigation', onNavigation);
		});
	}

	private untrackOwner(ownerId: number): void {
		if ([...this.sessions.values()].some((session) => session.owner.id === ownerId)) return;
		this.ownerCleanup.get(ownerId)?.();
		this.ownerCleanup.delete(ownerId);
	}
}
