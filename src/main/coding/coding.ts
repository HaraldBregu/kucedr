import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import type {
	CodingSettings,
	CodingRunRequest,
	CodingResponseEvent,
	CodingRunResult,
	CodingAuthEvent,
	CodingAuthStatus,
	CoderHarness,
	CoderInteractionResponse,
	CodingProjectInstructionsUpdate,
} from '../../shared/coding_types';
import { CODER_HARNESSES, isCodingSettings } from '../../shared/coding_types';
import { userDataLocation } from '../shared/user_data_location';
import { Pi } from './pi';
import { CodingStore } from './store';
import { CodingProjectStore } from './projects';
import { CoderSessions, type CoderSession } from './sessions';
import { CoderCredentials } from './credentials';
import { CodexHarness } from './harness/codex';
import { ClineHarness } from './harness/cline';
import type { CodingHarness, HarnessContext, HarnessEvent } from './harness/types';
import { executeCommand } from './shell';
import { CodingInstructions } from './instructions';

interface CodingDependencies {
	readonly store: CodingStore;
	readonly projects: CodingProjectStore;
	readonly harnesses?: Partial<Record<CoderHarness, CodingHarness>>;
	readonly sessions?: CoderSessions;
	readonly credentials?: Pick<CoderCredentials, 'get' | 'set'>;
}
interface ActiveRun {
	ownerId: number;
	controller: AbortController;
	sessionId: string;
	projectId: string;
}
interface PendingInteraction {
	runId: string;
	ownerId: number;
	resolve: (response: CoderInteractionResponse) => void;
}

export class Coder {
	private readonly pi: Pi;
	private readonly sessions: CoderSessions;
	private readonly credentials: Pick<CoderCredentials, 'get' | 'set'>;
	private readonly harnesses: Record<CoderHarness, CodingHarness>;
	private readonly runs = new Map<string, ActiveRun>();
	private readonly interactions = new Map<string, PendingInteraction>();
	private readonly auth = new Map<number, AbortController>();
	private readonly instructions = new CodingInstructions();
	constructor(private readonly dependencies: CodingDependencies) {
		this.sessions = dependencies.sessions ?? new CoderSessions();
		this.credentials = dependencies.credentials ?? new CoderCredentials();
		this.pi = new Pi({
			...dependencies,
			getProvider: (id) => {
				if (id !== 'openai' && id !== 'anthropic') return undefined;
				const key = this.credentials.get(id, 'pi');
				return key
					? {
							id,
							name: id,
							apiKey: key,
							baseUrl: id === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com',
						}
					: undefined;
			},
		});
		this.harnesses = {
			pi: {
				run: async (input, context) => {
					const project = this.dependencies.projects
						.list()
						.find((p) => p.directory === context.cwd);
					if (!project) throw new Error('Coder project was not found.');
					const runId = randomUUID();
					const abort = (): void => {
						this.pi.cancel(runId, 0);
					};
					context.signal.addEventListener('abort', abort, { once: true });
					try {
						context.signal.throwIfAborted();
						const result = await this.pi.send(
							0,
							runId,
							{
								projectId: project.id,
								sessionId: context.nativeSessionId,
								mode: 'agent',
								input,
								settings: context.settings,
							},
							(event) => {
								if (event.type !== 'status' && event.type !== 'error') context.emit(event);
							},
							context.saveSession,
							context.signal
						);
						return result.output;
					} finally {
						context.signal.removeEventListener('abort', abort);
					}
				},
				listModels: () => this.pi.listModels(),
			},
			codex: new CodexHarness(path.join(userDataLocation(), 'coder', 'codex'), () =>
				this.credentials.get('openai', 'codex')
			),
			cline: new ClineHarness(
				path.join(userDataLocation(), 'coder', 'cline'),
				() => this.credentials.get('cline', 'cline'),
				async (value) => this.credentials.set('cline', value ?? '', 'cline')
			),
			...dependencies.harnesses,
		};
	}
	getSettings(runtime?: CoderHarness): CodingSettings {
		this.validateHarness(runtime);
		return this.dependencies.store.get(runtime);
	}
	saveSettings(settings: CodingSettings): CodingSettings {
		this.validateSettings(settings);
		return this.dependencies.store.set(settings);
	}
	setApiKey(provider: 'openai' | 'anthropic' | 'cline', key: string, runtime?: CoderHarness): void {
		if (!['openai', 'anthropic', 'cline'].includes(provider) || typeof key !== 'string')
			throw new Error('Invalid Coder API key.');
		const selected = this.getSettings(runtime).runtime;
		if (
			(selected === 'codex' && provider !== 'openai') ||
			(selected === 'cline' && provider !== 'cline') ||
			(selected === 'pi' && provider === 'cline')
		)
			throw new Error('API key provider does not match the harness.');
		this.credentials.set(provider, key, selected);
	}
	listModels(runtime?: CoderHarness) {
		const selected = this.getSettings(runtime).runtime;
		return this.harnesses[selected].listModels();
	}
	listProjects() {
		return this.dependencies.projects.list();
	}
	addProject(directory: string) {
		return this.dependencies.projects.add(directory);
	}
	removeProject(id: string) {
		if ([...this.runs.values()].some((r) => r.projectId === id))
			throw new Error('Stop the project run first.');
		return this.dependencies.projects.remove(id);
	}
	readProjectFile(id: string, file: string) {
		return this.pi.readProjectFile(id, file);
	}
	listProjectFiles(id: string) {
		return this.pi.listProjectFiles(id);
	}
	createProjectFile(id: string, file: string) {
		return this.pi.createProjectFile(id, file);
	}
	getProjectInstructions(id: string, runtime?: CoderHarness) {
		this.validateHarness(runtime);
		return this.instructions.get(this.requireProject(id), runtime ?? this.getSettings().runtime);
	}
	saveProjectInstructions(
		id: string,
		update: CodingProjectInstructionsUpdate,
		runtime?: CoderHarness
	) {
		this.validateHarness(runtime);
		return this.instructions.save(
			this.requireProject(id),
			update,
			runtime ?? this.getSettings().runtime
		);
	}
	async listSessions(projectId: string) {
		this.requireProject(projectId);
		const managed = this.sessions.list(projectId);
		const nativeIds = new Set(
			managed.filter((s) => s.runtime === 'pi').map((s) => s.nativeSessionId)
		);
		const legacy = await this.pi.listSessions(projectId);
		return [
			...managed,
			...legacy
				.filter((s) => !nativeIds.has(s.id) && !managed.some((m) => m.id === s.id))
				.map((s) => ({
					...s,
					runtime: 'pi' as const,
					workingDirectory: this.requireProject(projectId).directory,
				})),
		].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	}
	async getSession(projectId: string, id: string) {
		const managed = this.sessions.read(id);
		if (managed) {
			this.assertProject(managed, projectId);
			return this.sessions.snapshot(managed);
		}
		const snapshot = await this.pi.getSession(projectId, id);
		return {
			...snapshot,
			session: {
				...snapshot.session,
				runtime: 'pi' as const,
				workingDirectory: this.requireProject(projectId).directory,
				settings: this.getSettings('pi'),
			},
		};
	}
	async renameSession(projectId: string, id: string, title: string) {
		this.assertIdle(id);
		if (typeof title !== 'string' || !title.trim() || title.trim().length > 120)
			throw new Error('Invalid Coder session title.');
		const session = this.sessions.read(id);
		if (!session) return this.pi.renameSession(projectId, id, title);
		this.assertProject(session, projectId);
		const next = { ...session, title: title.trim(), updatedAt: new Date().toISOString() };
		this.sessions.save(next);
		return next;
	}
	async deleteSession(projectId: string, id: string) {
		this.assertIdle(id);
		const session = this.sessions.read(id);
		if (!session) return this.pi.deleteSession(projectId, id);
		this.assertProject(session, projectId);
		if (session.nativeSessionId) {
			if (session.runtime === 'pi') {
				if (
					(await this.pi.listSessions(projectId)).some(
						(item) => item.id === session.nativeSessionId
					)
				)
					await this.pi.deleteSession(projectId, session.nativeSessionId);
			} else await this.harnesses[session.runtime].deleteSession?.(session.nativeSessionId);
		}
		return this.sessions.delete(id);
	}
	async saveSessionSettings(projectId: string, id: string, settings: CodingSettings) {
		this.assertIdle(id);
		this.validateSettings(settings);
		let session = this.sessions.read(id);
		if (!session) {
			const snapshot = await this.pi.getSession(projectId, id);
			if (settings.runtime !== 'pi') throw new Error('Create a new session to change harness.');
			const cwd = this.requireProject(projectId).directory;
			if (settings.workingDirectory && path.resolve(settings.workingDirectory) !== cwd)
				throw new Error('Create a new session to change directory.');
			session = this.sessions.create(projectId, cwd, settings, snapshot.session.title, id, id);
			this.sessions.append(id, { type: 'seed', blocks: snapshot.blocks });
		}
		this.assertProject(session, projectId);
		if (
			session.runtime !== settings.runtime ||
			(settings.workingDirectory &&
				path.resolve(settings.workingDirectory) !== session.workingDirectory)
		)
			throw new Error('Create a new session to change harness or directory.');
		const next = {
			...session,
			settings: { ...settings, workingDirectory: session.workingDirectory },
			updatedAt: new Date().toISOString(),
		};
		this.sessions.save(next);
		return next;
	}
	async send(
		ownerId: number,
		runId: string,
		request: CodingRunRequest,
		emit: (event: CodingResponseEvent) => void
	): Promise<CodingRunResult> {
		if (this.runs.has(runId)) throw new Error('Coder run id is already active.');
		const id = request.sessionId ?? randomUUID();
		this.assertIdle(id);
		const run: ActiveRun = {
			ownerId,
			controller: new AbortController(),
			sessionId: id,
			projectId: request.projectId,
		};
		this.runs.set(runId, run);
		const timeout = setTimeout(() => run.controller.abort(), 30 * 60 * 1000);
		let session: CoderSession | undefined;
		let eventContext = { runId, projectId: request.projectId, sessionId: id };
		const publish = (event: HarnessEvent): void => {
			const value = { ...event, ...eventContext } as CodingResponseEvent;
			if (session) this.sessions.append(id, value);
			if (
				!run.controller.signal.aborted ||
				event.type === 'status' ||
				event.type === 'error' ||
				event.type === 'interaction-resolved' ||
				event.type === 'command-end'
			)
				emit(value);
		};
		try {
			const candidate = this.sessions.read(id);
			if (candidate) {
				this.assertProject(candidate, request.projectId);
				session = candidate;
				if (
					request.settings &&
					(['runtime', 'providerId', 'modelId', 'thinkingLevel', 'toolMode'] as const).some(
						(key) => request.settings![key] !== session!.settings[key]
					)
				)
					throw new Error('Save session settings before starting a run.');
			} else if (request.sessionId) {
				const legacy = await this.pi.getSession(request.projectId, id);
				session = this.sessions.create(
					request.projectId,
					this.requireProject(request.projectId).directory,
					this.getSettings('pi'),
					legacy.session.title,
					id,
					id
				);
				this.sessions.append(id, { type: 'seed', blocks: legacy.blocks });
			} else {
				const settings = request.settings ?? this.getSettings();
				this.validateSettings(settings);
				const selected = request.projectId ? this.requireProject(request.projectId) : undefined;
				const cwd = request.workingDirectory ?? selected?.directory ?? settings.workingDirectory;
				if (!cwd) throw new Error('Choose a working directory.');
				const project = this.dependencies.projects.add(cwd);
				session = this.sessions.create(project.id, project.directory, settings, request.input, id);
			}
			const project = this.requireProject(session.projectId);
			if (realpathSync(project.directory) !== session.workingDirectory)
				throw new Error('The session working directory has changed.');
			if (
				request.workingDirectory &&
				realpathSync(request.workingDirectory) !== session.workingDirectory
			)
				throw new Error('Create a new session to change directory.');
			run.projectId = session.projectId;
			eventContext = { ...eventContext, projectId: session.projectId };
			run.controller.signal.throwIfAborted();
			this.sessions.append(id, { type: 'prompt', runId, input: request.input, mode: request.mode });
			publish({ type: 'status', status: 'started' });
			const context: HarnessContext = {
				cwd: session.workingDirectory,
				settings: session.settings,
				nativeSessionId: session.nativeSessionId,
				signal: run.controller.signal,
				emit: publish,
				saveSession: async (nativeSessionId) => {
					session = { ...session!, nativeSessionId };
					this.sessions.save(session);
				},
				approve: async (interaction) => {
					run.controller.signal.throwIfAborted();
					const requestId = randomUUID();
					const response = await new Promise<CoderInteractionResponse>((resolve) => {
						const abort = (): void => {
							this.interactions.delete(requestId);
							resolve({ approved: false });
						};
						run.controller.signal.addEventListener('abort', abort, { once: true });
						this.interactions.set(requestId, {
							runId,
							ownerId,
							resolve: (value) => {
								run.controller.signal.removeEventListener('abort', abort);
								this.interactions.delete(requestId);
								resolve(value);
							},
						});
						publish({ ...interaction, type: 'interaction', requestId });
					});
					publish({ type: 'interaction-resolved', requestId, approved: response.approved });
					run.controller.signal.throwIfAborted();
					return response;
				},
			};
			const output =
				request.mode === 'shell'
					? await executeCommand(request.input, context)
					: await this.harnesses[session.runtime].run(request.input, context);
			run.controller.signal.throwIfAborted();
			publish({ type: 'status', status: 'completed' });
			this.dependencies.projects.touch(session.projectId);
			return { projectId: session.projectId, sessionId: id, output };
		} catch (error) {
			if (run.controller.signal.aborted) publish({ type: 'status', status: 'cancelled' });
			else
				publish({
					type: 'error',
					message: error instanceof Error ? error.message : 'Coder run failed.',
				});
			throw error;
		} finally {
			run.controller.abort();
			clearTimeout(timeout);
			this.runs.delete(runId);
			if (session) {
				const snapshot = this.sessions.snapshot(session);
				this.sessions.save({
					...session,
					updatedAt: new Date().toISOString(),
					messageCount: snapshot.session.messageCount,
				});
			}
		}
	}
	respond(
		runId: string,
		requestId: string,
		response: CoderInteractionResponse,
		ownerId: number
	): boolean {
		if (
			!response ||
			typeof response.approved !== 'boolean' ||
			(response.answers !== undefined &&
				(typeof response.answers !== 'object' ||
					response.answers === null ||
					Array.isArray(response.answers) ||
					Object.values(response.answers).some((v) => typeof v !== 'string')))
		)
			throw new Error('Invalid Coder interaction response.');
		const pending = this.interactions.get(requestId);
		if (!pending || pending.runId !== runId || pending.ownerId !== ownerId) return false;
		pending.resolve(response);
		return true;
	}
	cancel(runId: string, ownerId: number): boolean {
		const run = this.runs.get(runId);
		if (!run || run.ownerId !== ownerId) return false;
		run.controller.abort();
		return true;
	}
	cancelWindow(ownerId: number): void {
		for (const [id, run] of this.runs) if (run.ownerId === ownerId) this.cancel(id, ownerId);
		this.cancelCodexLogin(ownerId);
	}
	async connectCodex(
		ownerId: number,
		emit: (event: CodingAuthEvent) => void,
		runtime?: CoderHarness
	): Promise<CodingAuthStatus> {
		const selected = this.getSettings(runtime).runtime;
		if (this.auth.has(ownerId)) throw new Error('A login is already in progress.');
		const controller = new AbortController();
		this.auth.set(ownerId, controller);
		const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
		try {
			if (selected === 'pi') return await this.pi.connectCodex(ownerId, emit);
			const harness = this.harnesses[selected];
			if (!harness.connect) throw new Error('Save an API key to connect this harness.');
			const status = await harness.connect(controller.signal, emit);
			if (selected === 'codex' && status.configured && this.credentials.get('openai', 'codex'))
				this.credentials.set('openai', '', 'codex');
			return status;
		} finally {
			clearTimeout(timer);
			this.auth.delete(ownerId);
		}
	}
	cancelCodexLogin(ownerId: number): boolean {
		this.pi.cancelCodexLogin(ownerId);
		const controller = this.auth.get(ownerId);
		if (!controller) return false;
		controller.abort();
		return true;
	}
	async disconnectCodex(runtime?: CoderHarness): Promise<void> {
		const selected = this.getSettings(runtime).runtime;
		if (selected === 'pi') await this.pi.disconnectCodex();
		else {
			await this.harnesses[selected].disconnect?.();
			if (selected === 'codex' && this.credentials.get('openai', 'codex'))
				this.credentials.set('openai', '', 'codex');
		}
	}
	destroy(): void {
		for (const run of this.runs.values()) run.controller.abort();
		for (const controller of this.auth.values()) controller.abort();
		this.pi.destroy();
		for (const harness of Object.values(this.harnesses)) harness.destroy?.();
		this.runs.clear();
		this.auth.clear();
	}
	private assertIdle(id: string): void {
		if ([...this.runs.values()].some((r) => r.sessionId === id))
			throw new Error('This Coder session already has an active run.');
	}
	private assertProject(session: CoderSession, projectId: string): void {
		if (session.projectId !== projectId)
			throw new Error('Coder session was not found for this project.');
	}
	private requireProject(id: string) {
		const project = this.dependencies.projects.get(id);
		if (!project || !project.available) throw new Error('Coder project directory is unavailable.');
		return project;
	}
	private validateHarness(runtime?: CoderHarness): void {
		if (runtime !== undefined && !CODER_HARNESSES.includes(runtime))
			throw new Error('Invalid Coder harness.');
	}
	private validateSettings(settings: CodingSettings): void {
		if (!isCodingSettings(settings)) throw new Error('Invalid Coder settings.');
		if (settings.runtime === 'codex' && settings.providerId !== 'openai-codex')
			throw new Error('Codex requires the Codex provider.');
		if (settings.runtime === 'cline' && settings.providerId !== 'cline')
			throw new Error('Cline requires the Cline provider.');
	}
}

export { Coder as Coding };
