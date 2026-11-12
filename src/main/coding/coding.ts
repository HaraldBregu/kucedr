import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { realpathSync, statSync } from 'node:fs';
import type {
	CodingSettings,
	CodingProjectCreate,
	CodingRunRequest,
	CodingResponseEvent,
	CodingRunResult,
	CodingAuthEvent,
	CodingAuthStatus,
	CoderHarness,
	CoderInteractionResponse,
	CodingProjectInstructionsUpdate,
} from '../../shared/coding_types';
import { isCodingSettings } from '../../shared/coding_types';
import type { CoderLayout } from '../../shared/coder_layout';
import { userDataLocation } from '../shared/user_data_location';
import { CodingStore } from './store';
import { CodingProjectStore } from './projects';
import { CoderSessions, type CoderSession } from './sessions';
import { CoderCredentials } from './credentials';
import { codingHarnesses, type CodingHarnessEntry } from './harnesses';
import { HARNESS_PROTOCOLS } from './harness/protocols';
import type { CodingHarness, HarnessContext, HarnessEvent } from './harness/types';
import { executeCommand } from './shell';
import { CodingInstructions } from './instructions';
import { listMarkdownFiles } from './markdown';
import { createProjectFile, listProjectFiles } from './files';
import { readProjectFile } from './read';
import { saveMarkdownFile } from './save';
import { readMarkdownFile } from './load';
import { createMarkdownFile } from './create';
import { deleteMarkdownFile } from './delete';

interface CodingDependencies {
	readonly store: CodingStore;
	readonly projects: CodingProjectStore;
	readonly harnesses?: Readonly<Record<string, CodingHarness>>;
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
	private readonly sessions: CoderSessions;
	private readonly credentials: Pick<CoderCredentials, 'get' | 'set'>;
	private readonly harnesses = new Map<string, CodingHarness>();
	private readonly runs = new Map<string, ActiveRun>();
	private readonly interactions = new Map<string, PendingInteraction>();
	private readonly auth = new Map<number, AbortController>();
	private readonly instructions = new CodingInstructions();
	constructor(private readonly dependencies: CodingDependencies) {
		this.sessions = dependencies.sessions ?? new CoderSessions();
		this.credentials = dependencies.credentials ?? new CoderCredentials();
		for (const [id, harness] of Object.entries(dependencies.harnesses ?? {}))
			this.harnesses.set(id, harness);
	}
	listHarnesses() {
		return codingHarnesses().map((entry) => entry.info);
	}
	getSettings(runtime?: CoderHarness): CodingSettings {
		this.validateHarness(runtime);
		return this.dependencies.store.get(runtime);
	}
	saveSettings(settings: CodingSettings): CodingSettings {
		this.validateSettings(settings);
		return this.dependencies.store.set(settings);
	}
	getLayout(): CoderLayout | null {
		return this.dependencies.store.getLayout();
	}
	saveLayout(layout: CoderLayout): CoderLayout {
		return this.dependencies.store.setLayout(layout);
	}
	setApiKey(provider: string, key: string, runtime?: CoderHarness): void {
		if (typeof key !== 'string') throw new Error('Invalid Coder API key.');
		const entry = this.entry(this.getSettings(runtime).runtime);
		if (provider !== entry.info.provider.id) throw new Error('Invalid Coder provider.');
		this.credentials.set(entry.credentialKey, key);
	}
	listModels(runtime?: CoderHarness) {
		return this.requireHarness(this.getSettings(runtime).runtime).listModels();
	}
	listProjects() {
		return this.dependencies.projects.list();
	}
	addProject(input?: CodingProjectCreate) {
		if (input?.settings && !this.isKnown(input.settings))
			throw new Error('Invalid Coder workspace configuration.');
		return this.dependencies.projects.create(input);
	}
	updateProject(id: string, input: CodingProjectCreate) {
		if (input?.settings && !this.isKnown(input.settings))
			throw new Error('Invalid Coder workspace configuration.');
		return this.dependencies.projects.update(id, input);
	}
	removeProject(id: string) {
		if ([...this.runs.values()].some((r) => r.projectId === id))
			throw new Error('Stop the project run first.');
		return this.dependencies.projects.remove(id);
	}
	async readProjectFile(id: string, file: string) {
		return readProjectFile(this.requireProject(id), file);
	}
	async listProjectFiles(id: string) {
		return listProjectFiles(this.requireProject(id));
	}
	listMarkdownFiles(id: string) {
		return listMarkdownFiles(this.requireProject(id));
	}
	readMarkdownFile(id: string, file: string) {
		return readMarkdownFile(this.requireProject(id), file);
	}
	createMarkdownFile(id: string, file: string) {
		return createMarkdownFile(this.requireProject(id), file);
	}
	deleteMarkdownFile(id: string, file: string) {
		return deleteMarkdownFile(this.requireProject(id), file);
	}
	saveMarkdownFile(id: string, file: string, content: string, expectedContent: string) {
		return saveMarkdownFile(this.requireProject(id), file, content, expectedContent);
	}
	async createProjectFile(id: string, file: string) {
		return createProjectFile(this.requireProject(id), file);
	}
	getProjectInstructions(id: string, runtime?: CoderHarness) {
		this.validateHarness(runtime);
		const selected = runtime ?? this.getSettings().runtime;
		return this.instructions.get(this.requireProject(id), selected, this.instructionFiles(selected));
	}
	saveProjectInstructions(
		id: string,
		update: CodingProjectInstructionsUpdate,
		runtime?: CoderHarness
	) {
		this.validateHarness(runtime);
		const selected = runtime ?? this.getSettings().runtime;
		return this.instructions.save(
			this.requireProject(id),
			update,
			selected,
			this.instructionFiles(selected)
		);
	}
	async listSessions(projectId: string) {
		this.requireProject(projectId);
		return this.sessions.list(projectId);
	}
	async getSession(projectId: string, id: string) {
		const session = this.requireSession(id);
		this.assertProject(session, projectId);
		return this.sessions.snapshot(session);
	}
	async renameSession(projectId: string, id: string, title: string) {
		this.assertIdle(id);
		if (typeof title !== 'string' || !title.trim() || title.trim().length > 120)
			throw new Error('Invalid Coder session title.');
		const session = this.requireSession(id);
		this.assertProject(session, projectId);
		const next = { ...session, title: title.trim(), updatedAt: new Date().toISOString() };
		this.sessions.save(next);
		return next;
	}
	async deleteSession(projectId: string, id: string) {
		this.assertIdle(id);
		const session = this.requireSession(id);
		this.assertProject(session, projectId);
		if (session.nativeSessionId)
			await this.requireHarness(session.runtime).deleteSession?.(session.nativeSessionId);
		return this.sessions.delete(id);
	}
	async saveSessionSettings(projectId: string, id: string, settings: CodingSettings) {
		this.assertIdle(id);
		this.validateSettings(settings);
		const session = this.requireSession(id);
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
	private canonicalDirectory(directory: string): string {
		if (!path.isAbsolute(directory)) throw new Error('Working directory must be absolute.');
		const canonical = realpathSync(directory);
		if (!statSync(canonical).isDirectory()) throw new Error('Working directory is unavailable.');
		return canonical;
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
				throw new Error('Coder session was not found for this project.');
			} else {
				const selected = request.projectId ? this.requireProject(request.projectId) : undefined;
				const settings = request.settings ?? selected?.settings ?? this.getSettings();
				this.validateSettings(settings);
				const cwd = request.workingDirectory ?? selected?.settings?.workingDirectory ?? selected?.directory ?? settings.workingDirectory;
				if (!cwd) throw new Error('Choose a working directory.');
				const directory = this.canonicalDirectory(cwd);
				const project = selected ?? this.dependencies.projects.add(directory);
				session = this.sessions.create(project.id, directory, settings, request.input, id);
			}
			this.requireProject(session.projectId);
			if (this.canonicalDirectory(session.workingDirectory) !== session.workingDirectory)
				throw new Error('The session working directory has changed.');
			if (
				request.workingDirectory &&
				this.canonicalDirectory(request.workingDirectory) !== session.workingDirectory
			)
				throw new Error('Create a new session to change directory.');
			run.projectId = session.projectId;
			eventContext = { ...eventContext, projectId: session.projectId };
			run.controller.signal.throwIfAborted();
			this.sessions.append(id, { type: 'prompt', runId, input: request.input, mode: request.mode });
			publish({ type: 'status', status: 'started' });
			const context: HarnessContext = {
				projectId: session.projectId,
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
					: await this.requireHarness(session.runtime).run(request.input, context);
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
			const harness = this.requireHarness(selected);
			if (!harness.connect) throw new Error('Save an API key to connect this harness.');
			const status = await harness.connect(controller.signal, emit);
			const entry = this.entry(selected);
			if (entry.model.authentication === 'oauth2' && status.configured && this.credentials.get(entry.credentialKey))
				this.credentials.set(entry.credentialKey, '');
			return status;
		} finally {
			clearTimeout(timer);
			this.auth.delete(ownerId);
		}
	}
	cancelCodexLogin(ownerId: number): boolean {
		const controller = this.auth.get(ownerId);
		if (!controller) return false;
		controller.abort();
		return true;
	}
	async disconnectCodex(runtime?: CoderHarness): Promise<void> {
		const selected = this.getSettings(runtime).runtime;
		await this.requireHarness(selected).disconnect?.();
		const entry = this.entry(selected);
		if (entry.model.authentication === 'oauth2' && this.credentials.get(entry.credentialKey))
			this.credentials.set(entry.credentialKey, '');
	}
	destroy(): void {
		for (const run of this.runs.values()) run.controller.abort();
		for (const controller of this.auth.values()) controller.abort();
		for (const harness of this.harnesses.values()) harness.destroy?.();
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
	private requireSession(id: string): CoderSession {
		const session = this.sessions.read(id);
		if (!session) throw new Error('Coder session was not found for this project.');
		return session;
	}
	private requireProject(id: string) {
		const project = this.dependencies.projects.get(id);
		if (!project || !project.available) throw new Error('Coder project directory is unavailable.');
		return project;
	}
	private validateHarness(runtime?: CoderHarness): void {
		if (runtime !== undefined) this.entry(runtime);
	}
	private validateSettings(settings: CodingSettings): void {
		if (!this.isKnown(settings)) throw new Error('Invalid Coder settings.');
	}
	private isKnown(settings: CodingSettings): boolean {
		return isCodingSettings(settings) && codingHarnesses().some(
			(entry) => entry.info.id === settings.runtime && entry.info.provider.id === settings.providerId
		);
	}
	private entry(runtime: CoderHarness): CodingHarnessEntry {
		const entry = codingHarnesses().find((item) => item.info.id === runtime);
		if (!entry) throw new Error('Invalid Coder harness.');
		return entry;
	}
	private instructionFiles(runtime: CoderHarness): readonly string[] {
		const files = this.entry(runtime).model.metadata?.harness?.instructionFiles;
		if (!files?.length) throw new Error('Coder harness has no instruction files.');
		return files;
	}
	private requireHarness(runtime: CoderHarness): CodingHarness {
		const cached = this.harnesses.get(runtime);
		if (cached) return cached;
		const entry = this.entry(runtime);
		const metadata = entry.model.metadata;
		const factory = metadata?.protocol && HARNESS_PROTOCOLS[metadata.protocol];
		if (!factory || !metadata?.harness) throw new Error('Coder harness has no supported protocol.');
		const harness = factory({
			directory: path.join(userDataLocation(), 'coder', runtime),
			name: entry.info.name,
			provider: { ...entry.info.provider, authentication: entry.model.authentication },
			harness: metadata.harness,
			getApiKey: () => this.credentials.get(entry.credentialKey),
		});
		this.harnesses.set(runtime, harness);
		return harness;
	}
}

export { Coder as Coding };
