import { mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import {
	createAgentSession,
	DefaultResourceLoader,
	ModelRuntime,
	SessionManager,
	SettingsManager,
	type AgentSessionEvent,
	type SessionInfo,
} from '@earendil-works/pi-coding-agent';
import type { StoredProvider } from '../../shared/provider_types';
import type {
	CodingAuthEvent,
	CodingAuthStatus,
	CodingCatalog,
	CodingProject,
	CodingProjectInstructions,
	CodingProjectInstructionsUpdate,
	CodingProvider,
	CodingProviderId,
	CodingResponseEvent,
	CodingRunRequest,
	CodingRunResult,
	CodingSessionBlock,
	CodingSessionSnapshot,
	CodingSessionSummary,
	CodingSettings,
} from '../../shared/coding_types';
import { codingLocation, codingSessionsLocation } from './location';
import { CodingInstructions } from './instructions';
import { CodingProjectStore } from './projects';
import { CodingStore } from './store';

const SUPPORTED_PROVIDERS: readonly CodingProviderId[] = ['openai-codex', 'openai', 'anthropic'];
const READ_ONLY_TOOLS = ['read', 'grep', 'find', 'ls'];
const CODING_TOOLS = ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'];
const RUN_TIMEOUT_MS = 30 * 60 * 1000;
const AUTH_TIMEOUT_MS = 10 * 60 * 1000;

interface ActiveRun {
	readonly ownerId: number;
	readonly projectId: string;
	readonly sessionId: string;
	readonly sessionKey: string;
	readonly controller: AbortController;
	abortSession?: () => Promise<void>;
}

interface CodingDependencies {
	readonly store: CodingStore;
	readonly projects: CodingProjectStore;
	readonly getProvider: (providerId: string) => StoredProvider | undefined;
}

export class Coder {
	private readonly runs = new Map<string, ActiveRun>();
	private readonly authControllers = new Map<number, AbortController>();
	private readonly instructions = new CodingInstructions();
	private runtimePromise?: Promise<ModelRuntime>;

	constructor(private readonly dependencies: CodingDependencies) {
		mkdirSync(codingLocation(), { recursive: true });
		mkdirSync(codingSessionsLocation(), { recursive: true });
	}

	getSettings(): CodingSettings {
		return this.dependencies.store.get();
	}

	saveSettings(settings: CodingSettings): CodingSettings {
		return this.dependencies.store.set(settings);
	}

	listProjects(): CodingProject[] {
		return this.dependencies.projects.list();
	}

	addProject(directory: string): CodingProject {
		return this.dependencies.projects.add(directory);
	}

	removeProject(projectId: string): boolean {
		if ([...this.runs.values()].some((run) => run.projectId === projectId)) {
			throw new Error('Stop the active project run before removing it from Coder.');
		}
		return this.dependencies.projects.remove(projectId);
	}

	async getProjectInstructions(projectId: string): Promise<CodingProjectInstructions> {
		return this.instructions.get(this.requireProject(projectId));
	}

	async saveProjectInstructions(
		projectId: string,
		update: CodingProjectInstructionsUpdate
	): Promise<CodingProjectInstructions> {
		return this.instructions.save(this.requireProject(projectId), update);
	}

	async listSessions(projectId: string): Promise<CodingSessionSummary[]> {
		const project = this.requireProject(projectId);
		const sessions = await SessionManager.list(project.directory, codingSessionsLocation());
		return sessions.map((session) => this.sessionSummary(project.id, session));
	}

	async getSession(projectId: string, sessionId: string): Promise<CodingSessionSnapshot> {
		const project = this.requireProject(projectId);
		const sessionInfo = await this.requireSession(project, sessionId);
		const manager = SessionManager.open(
			sessionInfo.path,
			codingSessionsLocation(),
			project.directory
		);
		const blocks = manager
			.buildSessionContext()
			.messages.map((message, index) => this.sessionBlock(message, index))
			.filter((block): block is CodingSessionBlock => Boolean(block));
		this.dependencies.projects.touch(project.id);
		return { session: this.sessionSummary(project.id, sessionInfo), blocks };
	}

	async renameSession(
		projectId: string,
		sessionId: string,
		title: string
	): Promise<CodingSessionSummary> {
		const project = this.requireProject(projectId);
		const session = await this.requireSession(project, sessionId);
		if ([...this.runs.values()].some((run) => run.sessionKey === `${project.id}:${session.id}`)) {
			throw new Error('Stop the active run before renaming this session.');
		}
		const normalizedTitle = title.trim();
		if (!normalizedTitle || normalizedTitle.length > 120) {
			throw new Error('Coder session title must be between 1 and 120 characters.');
		}
		SessionManager.open(session.path, codingSessionsLocation(), project.directory).appendSessionInfo(
			normalizedTitle
		);
		const updated = await this.requireSession(project, sessionId);
		return this.sessionSummary(project.id, updated);
	}

	async deleteSession(projectId: string, sessionId: string): Promise<boolean> {
		const project = this.requireProject(projectId);
		const session = await this.requireSession(project, sessionId);
		if ([...this.runs.values()].some((run) => run.sessionKey === `${project.id}:${session.id}`)) {
			throw new Error('Stop the active run before deleting this session.');
		}
		const root = path.resolve(codingSessionsLocation());
		const target = path.resolve(session.path);
		const relative = path.relative(root, target);
		if (
			!relative ||
			relative === '..' ||
			relative.startsWith(`..${path.sep}`) ||
			path.isAbsolute(relative)
		) {
			throw new Error('Coder session path is invalid.');
		}
		unlinkSync(target);
		return true;
	}

	async listModels(): Promise<CodingCatalog> {
		const runtime = await this.getRuntime();
		await this.syncApiKeys(runtime);
		const providers = await Promise.all(
			runtime
				.getProviders()
				.filter((provider) => SUPPORTED_PROVIDERS.includes(provider.id as CodingProviderId))
				.map(async (provider): Promise<CodingProvider> => {
					const id = provider.id as CodingProviderId;
					const auth = await runtime.checkAuth(id);
					return {
						id,
						name: provider.name,
						authentication: id === 'openai-codex' ? 'oauth' : 'api-key',
						configured: Boolean(auth),
						...(auth?.type ? { authType: auth.type } : {}),
						...(auth?.source ? { authSource: auth.source } : {}),
						models: runtime.getModels(id).map((model) => ({
							id: model.id,
							name: model.name,
							reasoning: model.reasoning,
							contextWindow: model.contextWindow,
						})),
					};
				})
		);
		return { providers };
	}

	async connectCodex(
		windowId: number,
		emit: (event: CodingAuthEvent) => void
	): Promise<CodingAuthStatus> {
		if (this.authControllers.has(windowId))
			throw new Error('A Codex login is already in progress.');
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
		this.authControllers.set(windowId, controller);
		try {
			const runtime = await this.getRuntime();
			await runtime.login('openai-codex', 'oauth', {
				signal: controller.signal,
				prompt: async (prompt) => {
					if (prompt.type !== 'select') {
						throw new Error('The Codex device login requested unsupported user input.');
					}
					const deviceOption = prompt.options.find((option) => option.id === 'device_code');
					if (!deviceOption) throw new Error('Codex device login is unavailable.');
					return deviceOption.id;
				},
				notify: (event) => {
					if (event.type === 'device_code') {
						emit({
							type: 'device-code',
							userCode: event.userCode,
							verificationUri: event.verificationUri,
							...(event.expiresInSeconds ? { expiresInSeconds: event.expiresInSeconds } : {}),
						});
					} else if (event.type === 'auth_url') {
						emit({
							type: 'auth-url',
							url: event.url,
							...(event.instructions ? { instructions: event.instructions } : {}),
						});
					} else if (event.type === 'info') {
						emit({
							type: 'info',
							message: event.message,
							...(event.links?.[0]?.url ? { url: event.links[0].url } : {}),
						});
					} else {
						emit({ type: 'progress', message: event.message });
					}
				},
			});
			const auth = await runtime.checkAuth('openai-codex');
			return {
				configured: Boolean(auth),
				...(auth?.type ? { type: auth.type } : {}),
				...(auth?.source ? { source: auth.source } : {}),
			};
		} finally {
			clearTimeout(timeout);
			this.authControllers.delete(windowId);
		}
	}

	cancelCodexLogin(windowId: number): boolean {
		const controller = this.authControllers.get(windowId);
		if (!controller) return false;
		controller.abort();
		return true;
	}

	async disconnectCodex(): Promise<void> {
		const runtime = await this.getRuntime();
		await runtime.logout('openai-codex');
	}

	async send(
		ownerId: number,
		runId: string,
		request: CodingRunRequest,
		emit: (event: CodingResponseEvent) => void
	): Promise<CodingRunResult> {
		if (this.runs.has(runId)) throw new Error('Coder run id is already active.');
		const project = this.requireProject(request.projectId);
		const sessionManager = request.sessionId
			? SessionManager.open(
					(await this.requireSession(project, request.sessionId)).path,
					codingSessionsLocation(),
					project.directory
				)
			: SessionManager.create(project.directory, codingSessionsLocation());
		const sessionId = sessionManager.getSessionId();
		const sessionKey = `${project.id}:${sessionId}`;
		if ([...this.runs.values()].some((run) => run.sessionKey === sessionKey)) {
			throw new Error('This Coder session already has an active run.');
		}
		const controller = new AbortController();
		const run: ActiveRun = {
			ownerId,
			projectId: project.id,
			sessionId,
			sessionKey,
			controller,
		};
		const eventContext = { runId, projectId: project.id, sessionId };
		this.runs.set(runId, run);
		const timeout = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
		try {
			const settings = this.getSettings();
			const runtime = await this.getRuntime();
			await this.syncApiKeys(runtime);
			const model = runtime.getModel(settings.providerId, settings.modelId);
			if (!model) throw new Error('Select an available Pi model in Coder settings.');
			if (!(await runtime.checkAuth(settings.providerId))) {
				throw new Error(`Connect ${settings.providerId} before starting a coder run.`);
			}
			const settingsManager = SettingsManager.inMemory(
				{
					defaultProvider: settings.providerId,
					defaultModel: settings.modelId,
					defaultThinkingLevel: settings.thinkingLevel,
					enableAnalytics: false,
					enableInstallTelemetry: false,
				},
				{ projectTrusted: true }
			);
			const resourceLoader = new DefaultResourceLoader({
				cwd: project.directory,
				agentDir: codingLocation(),
				settingsManager,
				noExtensions: true,
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			});
			await resourceLoader.reload();
			const { session } = await createAgentSession({
				cwd: project.directory,
				agentDir: codingLocation(),
				modelRuntime: runtime,
				model,
				thinkingLevel: settings.thinkingLevel,
				tools: settings.toolMode === 'coding' ? CODING_TOOLS : READ_ONLY_TOOLS,
				resourceLoader,
				sessionManager,
				settingsManager,
			});
			run.abortSession = async () => {
				session.abortBash();
				await session.abort();
			};
			emit({ ...eventContext, type: 'status', status: 'started' });
			let output = '';
			let finalError: string | undefined;
			const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
				if (event.type === 'message_update') {
					const update = event.assistantMessageEvent;
					if (update.type === 'text_delta') {
						output += update.delta;
						emit({ ...eventContext, type: 'text-delta', delta: update.delta });
					} else if (update.type === 'thinking_delta') {
						emit({ ...eventContext, type: 'thinking-delta', delta: update.delta });
					} else if (update.type === 'error') {
						finalError = update.error.errorMessage || 'Pi stopped with an error.';
					}
				} else if (event.type === 'tool_execution_start') {
					emit({
						...eventContext,
						type: 'tool-start',
						toolCallId: event.toolCallId,
						toolName: event.toolName,
					});
				} else if (event.type === 'tool_execution_end') {
					emit({
						...eventContext,
						type: 'tool-end',
						toolCallId: event.toolCallId,
						toolName: event.toolName,
						isError: event.isError,
					});
				}
			});
			const abortSession = (): void => {
				session.abortBash();
				void session.abort();
			};
			controller.signal.addEventListener('abort', abortSession, { once: true });
			try {
				if (controller.signal.aborted) throw new Error('Coder run cancelled.');
				if (request.mode === 'shell') {
					emit({ ...eventContext, type: 'command-start', command: request.input });
					const result = await session.executeBash(request.input, (delta) => {
						output += delta;
						emit({ ...eventContext, type: 'command-output', delta });
					});
					emit({
						...eventContext,
						type: 'command-end',
						...(result.exitCode === undefined ? {} : { exitCode: result.exitCode }),
						cancelled: result.cancelled,
						truncated: result.truncated,
					});
					if (controller.signal.aborted || result.cancelled)
						throw new Error('Coder run cancelled.');
				} else {
					await session.prompt(request.input, { expandPromptTemplates: false, source: 'rpc' });
					if (controller.signal.aborted) throw new Error('Coder run cancelled.');
					if (finalError) throw new Error(finalError);
				}
				emit({ ...eventContext, type: 'status', status: 'completed' });
				this.dependencies.projects.touch(project.id);
				return { projectId: project.id, sessionId, output };
			} finally {
				controller.signal.removeEventListener('abort', abortSession);
				unsubscribe();
				session.dispose();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Coder run failed.';
			if (controller.signal.aborted) {
				emit({ ...eventContext, type: 'status', status: 'cancelled' });
			} else {
				emit({ ...eventContext, type: 'error', message });
			}
			throw error;
		} finally {
			clearTimeout(timeout);
			this.runs.delete(runId);
		}
	}

	cancel(runId: string, ownerId: number): boolean {
		const run = this.runs.get(runId);
		if (!run || run.ownerId !== ownerId) return false;
		run.controller.abort();
		void run.abortSession?.();
		return true;
	}

	cancelWindow(ownerId: number): void {
		for (const [runId, run] of this.runs) {
			if (run.ownerId === ownerId) this.cancel(runId, ownerId);
		}
		this.cancelCodexLogin(ownerId);
	}

	destroy(): void {
		for (const run of this.runs.values()) {
			run.controller.abort();
			void run.abortSession?.();
		}
		for (const controller of this.authControllers.values()) controller.abort();
		this.runs.clear();
		this.authControllers.clear();
	}

	private requireProject(projectId: string): CodingProject {
		const project = this.dependencies.projects.get(projectId);
		if (!project) throw new Error('Coder project was not found.');
		if (!project.available) throw new Error('Coder project directory is unavailable.');
		return project;
	}

	private async requireSession(project: CodingProject, sessionId: string): Promise<SessionInfo> {
		const sessions = await SessionManager.list(project.directory, codingSessionsLocation());
		const session = sessions.find((item) => item.id === sessionId);
		if (!session) throw new Error('Coder session was not found for this project.');
		return session;
	}

	private sessionSummary(projectId: string, session: SessionInfo): CodingSessionSummary {
		const firstMessage = session.firstMessage.trim();
		return {
			id: session.id,
			projectId,
			title: session.name?.trim() || firstMessage.slice(0, 80) || 'New session',
			createdAt: session.created.toISOString(),
			updatedAt: session.modified.toISOString(),
			messageCount: session.messageCount,
		};
	}

	private sessionBlock(message: unknown, index: number): CodingSessionBlock | undefined {
		if (!message || typeof message !== 'object') return undefined;
		const value = message as Record<string, unknown>;
		const timestamp =
			typeof value.timestamp === 'number'
				? new Date(value.timestamp).toISOString()
				: new Date(0).toISOString();
		const id = `${value.timestamp ?? 0}-${index}`;
		if (value.role === 'user' || value.role === 'assistant') {
			const content = this.messageText(value.content);
			if (!content) return undefined;
			return { id, type: 'message', role: value.role, content, timestamp };
		}
		if (value.role === 'bashExecution') {
			const exitCode = typeof value.exitCode === 'number' ? value.exitCode : undefined;
			const cancelled = value.cancelled === true;
			return {
				id,
				type: 'command',
				command: typeof value.command === 'string' ? value.command : '',
				output: typeof value.output === 'string' ? value.output : '',
				status: cancelled ? 'cancelled' : exitCode === 0 ? 'succeeded' : 'failed',
				...(exitCode === undefined ? {} : { exitCode }),
				truncated: value.truncated === true,
				timestamp,
			};
		}
		return undefined;
	}

	private messageText(content: unknown): string {
		if (typeof content === 'string') return content;
		if (!Array.isArray(content)) return '';
		return content
			.filter((item): item is { type: 'text'; text: string } =>
				Boolean(
					item &&
					typeof item === 'object' &&
					(item as Record<string, unknown>).type === 'text' &&
					typeof (item as Record<string, unknown>).text === 'string'
				)
			)
			.map((item) => item.text)
			.join('');
	}

	private getRuntime(): Promise<ModelRuntime> {
		this.runtimePromise ??= ModelRuntime.create({
			authPath: path.join(codingLocation(), 'auth.json'),
			modelsPath: null,
			allowModelNetwork: false,
		});
		return this.runtimePromise;
	}

	private async syncApiKeys(runtime: ModelRuntime): Promise<void> {
		for (const providerId of ['openai', 'anthropic'] as const) {
			const apiKey = this.dependencies.getProvider(providerId)?.apiKey.trim();
			if (apiKey) await runtime.setRuntimeApiKey(providerId, apiKey);
			else await runtime.removeRuntimeApiKey(providerId);
		}
	}
}
