import { authorizeRagDisclosure } from '../agent/knowledge/rag/disclosure';
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import { readRunInsights } from '../agent/session/insights';
import { readSpendReport } from '../agent/session/spend_report';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { watch } from 'chokidar';
import { realPath } from '../shared/real_path';
import type { IpcModule } from './core/module';
import type { EventBus } from '../event_bus';
import { wrapIpcHandler } from './core/error_handler';
import { AgentChannels } from '../../shared/ipc_channels_definitions';
import type { Agent } from '../agent/agent';
import type { LoggerService } from '../shared';
import type { PublicProvider } from '../../shared/provider_types';
import { loadProviders } from '../models';
import { getLanguage, getNotificationsEnabled, getProvider } from '../settings_store';
import { loadTranslations } from '../i18n';
import { createNotifier } from '../notifications/notifier';
import { isLocked } from '../lock/state';
import { listSchedules } from '../tasks';
import type {
	AgentContextMode,
	AgentMediaModelSettings,
	AgentRunOptions,
	AgentToolModelKind,
	AgentToolPermissionDecision,
	AgentToolPermissionScope,
	AgentUserInputAnswer,
	AgentUserInputScope,
	ModelReasoningEffort,
	WorkspaceChangeEvent,
	WorkspaceTreeEntry,
} from '../../shared/agent_types';
import type {
	AgentToolConfiguration,
	AgentToolProfileId,
	AgentToolReference,
} from '../../shared/agent_tools';
import { normalizeAgentInputFiles } from '../../shared/agent_files';
import { listModes } from '../agent/modes/list';
import { modeInfo } from '../agent/modes/info';
import {
	requireUuidSessionId,
	resolveStoredSessionId,
	searchSessions,
	sessionPath,
} from '../agent/session';
import { workspacePath } from '../agent/system';
import { readWorkspaces } from '../workspaces/read';
import { resolveWorkspace } from '../workspaces/resolve';
import { existsSync } from 'node:fs';
import { sendToWorkspace } from '../workspaces/send';
import { withinWorkspace } from '../workspaces/within';
import {
	getPermissions,
	permissionsView,
	resetPermissions,
	respondToolPermission,
	setPermissions,
	type PermissionRule,
	type PermissionRules,
	type PermissionsSchema,
	type PermissionsView,
} from '../agent/permissions';
import {
	getHealth,
	getHealthSettings,
	rescheduleHealth,
	resetHealthSettings,
	updateHealth,
	updateHealthSettings,
} from '../health';
import type { HealthSettings } from '../health/types';
import { resolveContextWindow } from '../models/context';
import { getResolvedProvider } from '../settings_store';
import {
	getModelId,
	clearModelOverride,
	getModelOptions,
	isModelOverridden,
	getRunBudget,
	setRunBudget,
	getCompactModel,
	getProviderId,
	getToolConfiguration,
	getToolModel,
	getToolProfile,
	setModelId,
	setModelOptions,
	setCompactModel,
	setProviderId,
	setToolProfileTool,
	setToolModel,
} from '../agent/agent_store';
import { modelTools } from '../agent/tools/model/tools';
import {
	getRagConfiguration,
	runRagIndexing,
	cancelRagIndexing,
	getRagStatus,
	saveRagConfiguration,
	searchRag,
	type RagIndexResult,
	type RagMatch,
} from '../agent/knowledge/rag';
import type { RagConfiguration } from '../../shared/rag_types';
import type { WorkspaceAsset } from '../../shared/workspace';
import { readWorkspaceAsset } from './asset';
import { createWorkspaceEntry } from './create';
import { importWorkspaceAsset } from './import';
import { cleanWorkspaceAssets } from './clean';
import { deleteWorkspaceFile } from './delete';
import { deleteWorkspaceDirectory } from './directory';
import { writeWorkspaceMarkdown } from './markdown';
import { writeWorkspaceFile } from './write';
import { duplicateWorkspaceFile } from './duplicate';
import { archiveWorkspaceEntry } from './archive';
import { readWorkspaceTextFile } from './text';
import { moveWorkspaceEntry } from './move';
import { transferWorkspaceEntry } from './transfer';
import { renameWorkspaceEntry } from './rename';
import { revealWorkspaceEntry } from './reveal';
import { readWorkspaceTree } from './tree';
import { respondUserInput } from '../agent/user_input/user_input_pending';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import type { IpcResult } from '../../shared/ipc_types';
import type { AgentInvokeChannelMap } from '../../shared/ipc_channels_types';
import { AgentRenderer } from './core/agent_renderer';

type AgentSendResult = AgentInvokeChannelMap[typeof AgentChannels.send]['result'];

export interface AgentIpcDeps {
	logger: LoggerService;
	agent: Agent;
	windows: WindowContextManager;
	apps: AppRegistry;
}

const TOOL_PERMISSION_DECISIONS: readonly AgentToolPermissionDecision[] = [
	'approve',
	'reject',
	'approve_always',
];

function isToolPermissionDecision(value: unknown): value is AgentToolPermissionDecision {
	return TOOL_PERMISSION_DECISIONS.includes(value as AgentToolPermissionDecision);
}

function toToolPermissionScope(value: unknown): AgentToolPermissionScope {
	if (!isRecord(value)) throw new Error('Invalid tool permission scope.');
	const approvalId = optionalTrimmedString(value.approvalId);
	const runId = optionalTrimmedString(value.runId);
	const toolName = optionalTrimmedString(value.toolName);
	const inputFingerprint = optionalTrimmedString(value.inputFingerprint);
	if (!approvalId || !runId || !toolName || !inputFingerprint)
		throw new Error('Invalid tool permission scope.');
	return {
		approvalId,
		runId,
		toolName,
		inputFingerprint,
	};
}

function toUserInputScope(value: unknown): AgentUserInputScope {
	if (!isRecord(value)) throw new Error('Invalid user input scope.');
	const requestId = optionalTrimmedString(value.requestId);
	const runId = optionalTrimmedString(value.runId);
	const toolCallId = optionalTrimmedString(value.toolCallId);
	const inputFingerprint = optionalTrimmedString(value.inputFingerprint);
	if (!requestId || !runId || !toolCallId || !inputFingerprint)
		throw new Error('Invalid user input scope.');
	return { requestId, runId, toolCallId, inputFingerprint };
}

function toUserInputAnswers(value: unknown): AgentUserInputAnswer[] {
	if (!Array.isArray(value) || value.length < 1 || value.length > 3)
		throw new Error('Invalid user input answers.');
	const answers = value.map((answer) => {
		if (!isRecord(answer)) throw new Error('Invalid user input answer.');
		const questionId = optionalTrimmedString(answer.questionId);
		const text = optionalTrimmedString(answer.answer);
		if (!questionId || !text || questionId.length > 64 || text.length > 1000)
			throw new Error('Invalid user input answer.');
		return { questionId, answer: text };
	});
	if (new Set(answers.map((answer) => answer.questionId)).size !== answers.length)
		throw new Error('User input answer IDs must be unique.');
	return answers;
}

const MODEL_REASONING_EFFORTS: readonly ModelReasoningEffort[] = [
	'none',
	'instant',
	'minimal',
	'low',
	'medium',
	'high',
	'xhigh',
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalTrimmedString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function toToolModelKind(value: unknown): AgentToolModelKind {
	if (value === 'image' || value === 'audio' || value === 'video') {
		return value;
	}
	throw new Error('Invalid tool model kind.');
}

function toAgentMediaModelSettings(value: unknown): AgentMediaModelSettings {
	if (!isRecord(value)) throw new Error('Invalid tool model settings.');
	if (
		typeof value.providerId !== 'string' ||
		typeof value.modelId !== 'string' ||
		!isRecord(value.options)
	) {
		throw new Error('Invalid tool model settings.');
	}
	return {
		providerId: value.providerId.trim(),
		modelId: value.modelId.trim(),
		options: { ...value.options },
	};
}

function toPermissionRules(value: unknown): PermissionRules {
	if (!isRecord(value)) throw new Error('Invalid permission rules.');
	const list = (input: unknown): PermissionRule[] => {
		if (!Array.isArray(input)) throw new Error('Invalid permission rules.');
		return input.map((item) => {
			const root = isRecord(item) ? optionalTrimmedString(item.root) : undefined;
			if (!isRecord(item) || !root || typeof item.recursive !== 'boolean')
				throw new Error('Invalid permission rules.');
			return { root, recursive: item.recursive };
		});
	};
	return { allow: list(value.allow), deny: list(value.deny) };
}

function toPermissions(value: unknown): PermissionsSchema {
	if (!isRecord(value)) throw new Error('Invalid permissions.');
	return {
		read: toPermissionRules(value.read),
		write: toPermissionRules(value.write),
		exec: toPermissionRules(value.exec),
	};
}

function toToolProfileId(value: unknown): AgentToolProfileId {
	if (value === 'chat' || value === 'voice' || value === 'tasks' || value === 'health')
		return value;
	throw new Error('Invalid tool profile.');
}

function toToolReference(value: unknown): AgentToolReference {
	if (!isRecord(value) || (value.kind !== 'builtin' && value.kind !== 'mcp'))
		throw new Error('Invalid tool reference.');
	if (value.kind === 'builtin') {
		const id = optionalTrimmedString(value.id);
		if (!id) throw new Error('Invalid built-in tool.');
		return { kind: 'builtin', id };
	}
	const serverId = optionalTrimmedString(value.serverId);
	const toolName = optionalTrimmedString(value.toolName);
	if (!serverId || !toolName) throw new Error('Invalid MCP tool.');
	return { kind: 'mcp', serverId, toolName };
}

function toToolConfiguration(value: unknown): AgentToolConfiguration {
	if (
		!isRecord(value) ||
		(value.permission !== 'ask' && value.permission !== 'allow' && value.permission !== 'deny')
	)
		throw new Error('Invalid tool configuration.');
	return { permission: value.permission };
}

function isModelReasoningEffort(value: unknown): value is ModelReasoningEffort {
	return MODEL_REASONING_EFFORTS.includes(value as ModelReasoningEffort);
}

function toPublicProvider(providerId: string): PublicProvider | undefined {
	if (providerId === 'custom') {
		const provider = getProvider('custom', 'models');
		return provider
			? {
					id: 'custom',
					name: provider.name,
					baseUrl: provider.baseUrl,
					capabilities: 'Custom models',
				}
			: undefined;
	}
	const catalogProvider = loadProviders().find((provider) => provider.id === providerId);
	if (!catalogProvider) return undefined;
	return {
		id: catalogProvider.id,
		name: catalogProvider.name,
		baseUrl: catalogProvider.baseUrl,
		...(catalogProvider.capabilities ? { capabilities: catalogProvider.capabilities } : {}),
		...(catalogProvider.apiConfiguration
			? { apiConfiguration: catalogProvider.apiConfiguration }
			: {}),
	};
}

function normalizeHealthSettingsPatch(value: Partial<HealthSettings>): Partial<HealthSettings> {
	return { ...value };
}

function wrapAgentHandler<TArgs extends unknown[], TResult>(
	access: (event: IpcMainInvokeEvent) => unknown,
	handler: (...args: TArgs) => Promise<TResult> | TResult,
	handlerName: string
): (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<IpcResult<TResult>> {
	return wrapIpcHandler((event, ...args) => {
		access(event);
		return handler(...args);
	}, handlerName);
}

export function normalizeAgentSendRuntimeOptions(options: unknown): AgentRunOptions {
	if (options === undefined || options === null) return {};
	if (!isRecord(options)) throw new Error('Invalid assistant runtime options.');
	if (
		options.modeIds !== undefined &&
		(!Array.isArray(options.modeIds) || options.modeIds.some((id) => typeof id !== 'string'))
	)
		throw new Error('Invalid assistant modes.');

	const sessionId =
		optionalTrimmedString(options.sessionId) ?? optionalTrimmedString(options.agentRuntime);
	const files = normalizeAgentInputFiles(options.files);
	return {
		...(options.modeIds === undefined ? {} : { modeIds: options.modeIds as string[] }),
		...(optionalTrimmedString(options.runId)
			? { runId: optionalTrimmedString(options.runId) }
			: {}),
		...(sessionId ? { sessionId } : {}),
		...(options.reuseLastUserMessage === true ? { reuseLastUserMessage: true } : {}),
		...(optionalTrimmedString(options.replyTo)
			? { replyTo: optionalTrimmedString(options.replyTo) }
			: {}),
		...(optionalTrimmedString(options.providerId)
			? { providerId: optionalTrimmedString(options.providerId) }
			: {}),
		...(optionalTrimmedString(options.model)
			? { model: optionalTrimmedString(options.model) }
			: {}),
		...(isModelReasoningEffort(options.effort) ? { effort: options.effort } : {}),
		...(options.contextMode === 'minimal' || options.contextMode === 'workspace'
			? { contextMode: options.contextMode as AgentContextMode }
			: typeof options.lightContext === 'boolean'
				? { contextMode: options.lightContext ? 'minimal' : 'workspace' }
				: {}),
		...(Array.isArray(options.toolsAllow)
			? {
					toolsAllow: options.toolsAllow.filter(
						(value): value is string => typeof value === 'string'
					),
				}
			: {}),
		...(Array.isArray(options.toolsDeny)
			? {
					toolsDeny: options.toolsDeny.filter(
						(value): value is string => typeof value === 'string'
					),
				}
			: {}),
		...(files ? { files } : {}),
	};
}

export class AgentIpc implements IpcModule<AgentIpcDeps> {
	readonly name = 'agent';

	register({ logger, agent, windows, apps }: AgentIpcDeps, eventBus: EventBus): void {
		const renderer = new AgentRenderer(windows, apps);
		const mainAccess = renderer.assert.bind(renderer);
		const workspaceAccess = renderer.assertWorkspace.bind(renderer);
		const notifier = createNotifier({
			enabled: getNotificationsEnabled,
			title: (signal) =>
				withinWorkspace(signal.workspaceId, () => {
					const lines = (
						loadTranslations(getLanguage(), 'main') as unknown as {
							notifications: { run: Record<string, string> };
						}
					).notifications.run;
					if (signal.category === 'health') return lines.healthTitle;
					if (isLocked()) return app.name;
					const title =
						signal.category === 'task'
							? listSchedules().find((schedule) =>
									schedule.sessionIds.includes(signal.sessionId)
								)?.name
							: agent.listSessions('main').find((session) => session.id === signal.sessionId)
									?.title;
					const workspace = readWorkspaces().find((record) => record.id === signal.workspaceId);
					return [title || app.name, ...(workspace ? [workspace.name] : [])].join(' · ');
				}),
			line: (key) =>
				(
					loadTranslations(getLanguage(), 'main') as unknown as {
						notifications: { run: Record<string, string> };
					}
				).notifications.run[key],
			open: (windowId, sessionId, workspaceId) =>
				eventBus.sendTo(windowId, AgentChannels.openSession, { sessionId, workspaceId }),
			resolve: (sessionId, workspaceId) =>
				resolveStoredSessionId(
					sessionId,
					resolveWorkspace(workspaceId).sessions,
					'main',
					workspaceId
				),
		});
		agent.onRun = notifier.run;
		ipcMain.handle(
			AgentChannels.viewSession,
			wrapIpcHandler((event, sessionId: unknown): void => {
				notifier.view(
					renderer.assert(event).id,
					typeof sessionId === 'string' ? sessionId : null,
					agent.config.workspace.id
				);
			}, AgentChannels.viewSession)
		);
		const watched = new Set<string>();
		const startWorkspaceWatcher = (root: string): void => {
			const { id } = agent.config.workspace;
			if (watched.has(id)) return;
			watched.add(id);
			const watcher = watch(root, {
				ignored: (file) =>
					path.relative(root, file).split(path.sep).some((part) => part === '.git' || part === 'node_modules'),
				ignoreInitial: true,
				awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 25 },
			});
			for (const type of ['add', 'change', 'unlink', 'addDir', 'unlinkDir'] as const) {
				watcher.on(type, (changedPath) => {
					const event: WorkspaceChangeEvent = {
						type,
						path: path.relative(root, changedPath),
					};
					sendToWorkspace(id, AgentChannels.workspaceChanged, event);
				});
			}
		};

		ipcMain.handle(
			AgentChannels.send,
			wrapIpcHandler(
				async (event, message: string, options?: unknown): Promise<AgentSendResult> => {
					const window = renderer.assert(event);
					const runtimeOptions = normalizeAgentSendRuntimeOptions(options);
					const runId = runtimeOptions.runId ?? randomUUID();
					const workspaceId = isRecord(options)
						? optionalTrimmedString(options.workspaceId)
						: undefined;
					let finished: AgentSendResult['finished'];
					const send = (): Promise<string> =>
						agent.send(message, 'main', {
							...runtimeOptions,
							runId,
							type: 'default',
							windowId: window.id,
							streamEvent: (responseEvent) => {
								if (
									responseEvent.type === 'run_finished' &&
									responseEvent.agentId === 'main' &&
									responseEvent.runId === runId
								)
									finished = responseEvent;
								eventBus.sendTo(window.id, AgentChannels.response, responseEvent);
							},
						});
					const text = await (workspaceId ? withinWorkspace(workspaceId, send) : send());
					return { text, ...(finished ? { finished } : {}) };
				},
				AgentChannels.send
			)
		);

		ipcMain.handle(
			AgentChannels.respondUserInput,
			wrapIpcHandler((event, value: unknown, answers: unknown): boolean => {
				const window = renderer.assert(event);
				return respondUserInput(toUserInputScope(value), toUserInputAnswers(answers), window.id);
			}, AgentChannels.respondUserInput)
		);

		ipcMain.handle(
			AgentChannels.getContextWindow,
			wrapAgentHandler(
				mainAccess,
				async () => {
					const providerId = getProviderId() ?? '';
					const modelId = getModelId() ?? '';
					const contextWindow = await resolveContextWindow(
						getResolvedProvider(providerId),
						modelId
					);
					return { providerId, modelId, contextWindow };
				},
				AgentChannels.getContextWindow
			)
		);

		ipcMain.handle(
			AgentChannels.listModes,
			wrapAgentHandler(mainAccess, () => listModes().map(modeInfo), AgentChannels.listModes)
		);

		ipcMain.handle(
			AgentChannels.getPromptInputCapabilities,
			wrapAgentHandler(
				mainAccess,
				() => agent.getPromptInputCapabilities(),
				AgentChannels.getPromptInputCapabilities
			)
		);

		ipcMain.handle(
			AgentChannels.cancel,
			wrapIpcHandler((event, value: unknown): boolean => {
				const window = renderer.assert(event);
				const runId = optionalTrimmedString(value);
				if (!runId) throw new Error('Invalid assistant run id.');
				return agent.cancel(runId, window.id);
			}, AgentChannels.cancel)
		);

		ipcMain.handle(
			AgentChannels.followUp,
			wrapIpcHandler((event, value: unknown, followUp: unknown): boolean => {
				const window = renderer.assert(event);
				const runId = optionalTrimmedString(value);
				const { id, text } = (followUp ?? {}) as { id?: unknown; text?: unknown };
				const followUpId = optionalTrimmedString(id);
				const followUpText = optionalTrimmedString(text);
				if (!runId) throw new Error('Invalid assistant run id.');
				if (!followUpId || !followUpText) throw new Error('Invalid follow-up.');
				return agent.followUp(runId, { id: followUpId, text: followUpText }, window.id);
			}, AgentChannels.followUp)
		);

		ipcMain.handle(
			AgentChannels.cancelFollowUp,
			wrapIpcHandler((event, value: unknown, id: unknown): boolean => {
				const window = renderer.assert(event);
				const runId = optionalTrimmedString(value);
				const followUpId = optionalTrimmedString(id);
				if (!runId) throw new Error('Invalid assistant run id.');
				if (!followUpId) throw new Error('Invalid follow-up.');
				return agent.cancelFollowUp(runId, followUpId, window.id);
			}, AgentChannels.cancelFollowUp)
		);

		ipcMain.handle(
			AgentChannels.respondToolPermission,
			wrapIpcHandler((event, value: unknown, decision: unknown): boolean => {
				const window = renderer.assert(event);
				const scope = toToolPermissionScope(value);
				if (!isToolPermissionDecision(decision)) throw new Error('Invalid permission decision.');
				return respondToolPermission(scope, decision, window.id);
			}, AgentChannels.respondToolPermission)
		);

		ipcMain.handle(
			AgentChannels.listSessions,
			wrapAgentHandler(
				mainAccess,
				(includeAll: boolean = false) => agent.listSessions(includeAll ? 'all' : 'main'),
				AgentChannels.listSessions
			)
		);

		ipcMain.handle(
			AgentChannels.getSpendReport,
			wrapAgentHandler(
				mainAccess,
				() => readSpendReport(agent.config.workspace.sessions, agent.listSessions('all')),
				AgentChannels.getSpendReport
			)
		);

		ipcMain.handle(
			AgentChannels.getRunInsights,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown, run: unknown) => {
					const selector = typeof run === 'number' ? run : optionalTrimmedString(run);
					if (!selector || (typeof selector === 'number' && (!Number.isSafeInteger(selector) || selector < 0)))
						throw new Error('Invalid assistant run identifier.');
					return readRunInsights(agent.config.workspace.sessions, requireUuidSessionId(sessionId), selector);
				},
				AgentChannels.getRunInsights
			)
		);

		ipcMain.handle(
			AgentChannels.searchSessions,
			wrapAgentHandler(
				mainAccess,
				(query: unknown) =>
					searchSessions(
						agent.config.workspace.sessions,
						typeof query === 'string' ? query : '',
						agent.config.workspace.id
					),
				AgentChannels.searchSessions
			)
		);

		ipcMain.handle(
			AgentChannels.openSessionsFolder,
			wrapAgentHandler(
				mainAccess,
				async (): Promise<void> => {
					const root = agent.config.workspace.sessions;
					await fs.mkdir(root, { recursive: true });
					const error = await shell.openPath(root);
					if (error) throw new Error(error);
				},
				AgentChannels.openSessionsFolder
			)
		);

		ipcMain.handle(
			AgentChannels.openSessionFolder,
			wrapAgentHandler(
				mainAccess,
				async (sessionId: unknown): Promise<void> => {
					const root = agent.config.workspace.sessions;
					const target = sessionPath(root, requireUuidSessionId(sessionId));
					const error = await shell.openPath(target);
					if (error) throw new Error(error);
				},
				AgentChannels.openSessionFolder
			)
		);

		ipcMain.handle(
			AgentChannels.renameSession,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown, title: unknown): Promise<void> => {
					const normalizedTitle = optionalTrimmedString(title);
					if (!normalizedTitle || normalizedTitle.length > 120)
						throw new Error('Chat title must be between 1 and 120 characters.');
					return agent.renameSession(requireUuidSessionId(sessionId), normalizedTitle);
				},
				AgentChannels.renameSession
			)
		);

		ipcMain.handle(
			AgentChannels.pinSession,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown, pinned: unknown): Promise<void> =>
					agent.pinSession(requireUuidSessionId(sessionId), pinned === true),
				AgentChannels.pinSession
			)
		);

		ipcMain.handle(
			AgentChannels.moveSession,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown, workspaceId: unknown): Promise<void> =>
					agent.moveSession(requireUuidSessionId(sessionId), String(workspaceId)),
				AgentChannels.moveSession
			)
		);

		ipcMain.handle(
			AgentChannels.categorizeSession,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown, category: unknown): Promise<void> =>
					agent.categorizeSession(requireUuidSessionId(sessionId), optionalTrimmedString(category) ?? null),
				AgentChannels.categorizeSession
			)
		);

		ipcMain.handle(
			AgentChannels.archiveSession,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown, archived: unknown): Promise<void> =>
					agent.archiveSession(requireUuidSessionId(sessionId), archived === true),
				AgentChannels.archiveSession
			)
		);

		ipcMain.handle(
			AgentChannels.lastMessages,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown) => {
					return agent.getLastMessages(requireUuidSessionId(sessionId));
				},
				AgentChannels.lastMessages
			)
		);

		ipcMain.handle(
			AgentChannels.sessionSnapshot,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown) => {
					return agent.getSessionSnapshot(requireUuidSessionId(sessionId));
				},
				AgentChannels.sessionSnapshot
			)
		);

		ipcMain.handle(
			AgentChannels.compactSession,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown) => agent.compactSession(requireUuidSessionId(sessionId)),
				AgentChannels.compactSession
			)
		);

		ipcMain.handle(
			AgentChannels.editUserMessage,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown, userOffsetFromEnd: unknown, content: unknown): Promise<boolean> => {
					if (!Number.isSafeInteger(userOffsetFromEnd) || Number(userOffsetFromEnd) < 0)
						throw new Error('Invalid user message offset.');
					const normalizedContent = optionalTrimmedString(content);
					if (content !== undefined && !normalizedContent)
						throw new Error('Invalid user message content.');
					return agent.editUserMessage(
						requireUuidSessionId(sessionId),
						Number(userOffsetFromEnd),
						normalizedContent
					);
				},
				AgentChannels.editUserMessage
			)
		);

		ipcMain.handle(
			AgentChannels.clearMessages,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown): Promise<void> => {
					return agent.clearMessages(requireUuidSessionId(sessionId));
				},
				AgentChannels.clearMessages
			)
		);

		ipcMain.handle(
			AgentChannels.deleteSession,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown): Promise<void> => {
					return agent.deleteSession(requireUuidSessionId(sessionId));
				},
				AgentChannels.deleteSession
			)
		);

		ipcMain.handle(
			AgentChannels.getWorkspaceLocation,
			wrapAgentHandler(
				workspaceAccess,
				(): string => {
					const root = workspacePath(agent.config);
					startWorkspaceWatcher(root);
					return root;
				},
				AgentChannels.getWorkspaceLocation
			)
		);

		ipcMain.handle(
			AgentChannels.listWorkspaceFiles,
			wrapAgentHandler(
				workspaceAccess,
				(): Promise<WorkspaceTreeEntry[]> => {
					const root = workspacePath(agent.config);
					startWorkspaceWatcher(root);
					return readWorkspaceTree(root);
				},
				AgentChannels.listWorkspaceFiles
			)
		);

		ipcMain.handle(
			AgentChannels.readWorkspaceFile,
			wrapAgentHandler(
				workspaceAccess,
				async (filePath: unknown): Promise<string> => {
					const normalizedFilePath = optionalTrimmedString(filePath);
					if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
					return readWorkspaceTextFile(workspacePath(agent.config), normalizedFilePath);
				},
				AgentChannels.readWorkspaceFile
			)
		);

		ipcMain.handle(
			AgentChannels.readPromptFile,
			wrapAgentHandler(
				mainAccess,
				async (filePath: unknown): Promise<Uint8Array> => {
					if (typeof filePath !== 'string' || !path.isAbsolute(filePath))
						throw new Error('Invalid prompt file path.');
					const stats = await fs.stat(filePath);
					if (!stats.isFile()) throw new Error('Prompt attachment must be a file.');
					return new Uint8Array(await fs.readFile(filePath));
				},
				AgentChannels.readPromptFile
			)
		);

		ipcMain.handle(
			AgentChannels.readWorkspaceAsset,
			wrapAgentHandler(
				workspaceAccess,
				async (filePath: unknown): Promise<WorkspaceAsset> => {
					const normalizedFilePath = optionalTrimmedString(filePath);
					if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
					return readWorkspaceAsset(workspacePath(agent.config), normalizedFilePath);
				},
				AgentChannels.readWorkspaceAsset
			)
		);

		ipcMain.handle(
			AgentChannels.writeWorkspaceFile,
			wrapAgentHandler(
				workspaceAccess,
				async (filePath: unknown, content: unknown): Promise<void> => {
					const normalizedFilePath = optionalTrimmedString(filePath);
					if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
					if (typeof content !== 'string') throw new Error('Invalid workspace file content.');
					await writeWorkspaceFile(workspacePath(agent.config), normalizedFilePath, content);
				},
				AgentChannels.writeWorkspaceFile
			)
		);

		ipcMain.handle(
			AgentChannels.writeWorkspaceMarkdown,
			wrapAgentHandler(
				workspaceAccess,
				async (filePath: unknown, content: unknown): Promise<void> => {
					const normalizedFilePath = optionalTrimmedString(filePath);
					if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
					if (typeof content !== 'string') throw new Error('Invalid workspace file content.');
					await writeWorkspaceMarkdown(workspacePath(agent.config), normalizedFilePath, content);
				},
				AgentChannels.writeWorkspaceMarkdown
			)
		);

		ipcMain.handle(
			AgentChannels.importWorkspaceAsset,
			wrapAgentHandler(
				workspaceAccess,
				async (documentPath: unknown, name: unknown, data: unknown): Promise<string> => {
					const normalizedDocumentPath = optionalTrimmedString(documentPath);
					if (!normalizedDocumentPath) throw new Error('Invalid workspace file path.');
					const normalizedName = optionalTrimmedString(name);
					if (!normalizedName) throw new Error('Invalid workspace file name.');
					if (!(data instanceof Uint8Array)) throw new Error('Invalid workspace asset data.');
					return importWorkspaceAsset(
						workspacePath(agent.config),
						normalizedDocumentPath,
						normalizedName,
						data
					);
				},
				AgentChannels.importWorkspaceAsset
			)
		);

		ipcMain.handle(
			AgentChannels.cleanWorkspaceAssets,
			wrapAgentHandler(
				workspaceAccess,
				async (documentPath: unknown): Promise<number> => {
					const normalizedDocumentPath = optionalTrimmedString(documentPath);
					if (!normalizedDocumentPath) throw new Error('Invalid workspace file path.');
					return cleanWorkspaceAssets(
						workspacePath(agent.config),
						normalizedDocumentPath,
						(filePath) => shell.trashItem(filePath)
					);
				},
				AgentChannels.cleanWorkspaceAssets
			)
		);

		ipcMain.handle(
			AgentChannels.createWorkspaceFile,
			wrapAgentHandler(
				workspaceAccess,
				async (parentPath: unknown, name: unknown): Promise<string> => {
					if (typeof parentPath !== 'string') throw new Error('Invalid workspace parent path.');
					const normalizedName = optionalTrimmedString(name);
					if (!normalizedName) throw new Error('Invalid workspace file name.');
					return createWorkspaceEntry(
						workspacePath(agent.config),
						parentPath.trim(),
						normalizedName,
						'file'
					);
				},
				AgentChannels.createWorkspaceFile
			)
		);

		ipcMain.handle(
			AgentChannels.createWorkspaceDirectory,
			wrapAgentHandler(
				workspaceAccess,
				async (parentPath: unknown, name: unknown): Promise<string> => {
					if (typeof parentPath !== 'string') throw new Error('Invalid workspace parent path.');
					const normalizedName = optionalTrimmedString(name);
					if (!normalizedName) throw new Error('Invalid workspace folder name.');
					return createWorkspaceEntry(
						workspacePath(agent.config),
						parentPath.trim(),
						normalizedName,
						'directory'
					);
				},
				AgentChannels.createWorkspaceDirectory
			)
		);

		ipcMain.handle(
			AgentChannels.duplicateWorkspaceFile,
			wrapAgentHandler(
				workspaceAccess,
				async (filePath: unknown): Promise<string> => {
					const normalizedFilePath = optionalTrimmedString(filePath);
					if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
					return duplicateWorkspaceFile(workspacePath(agent.config), normalizedFilePath);
				},
				AgentChannels.duplicateWorkspaceFile
			)
		);

		ipcMain.handle(
			AgentChannels.archiveWorkspaceEntry,
			wrapAgentHandler(
				workspaceAccess,
				async (entryPath: unknown, action: unknown): Promise<string> => {
					const normalizedEntryPath = optionalTrimmedString(entryPath);
					if (!normalizedEntryPath) throw new Error('Invalid workspace file path.');
					if (action === 'export-downloads' || action === 'export-choose') {
						let exportDirectory = app.getPath('downloads');
						if (action === 'export-choose') {
							const window = BrowserWindow.getFocusedWindow();
							const options = {
								defaultPath: exportDirectory,
								properties: ['openDirectory' as const, 'createDirectory' as const],
							};
							const result = await (window
								? dialog.showOpenDialog(window, options)
								: dialog.showOpenDialog(options));
							if (result.canceled) return '';
							exportDirectory = result.filePaths[0];
						}
						const destination = await archiveWorkspaceEntry(workspacePath(agent.config), normalizedEntryPath, 'compress', exportDirectory);
						shell.showItemInFolder(destination);
						return destination;
					}
					if (action !== 'compress' && action !== 'extract') {
						throw new Error('Invalid workspace archive action.');
					}
					return archiveWorkspaceEntry(workspacePath(agent.config), normalizedEntryPath, action);
				},
				AgentChannels.archiveWorkspaceEntry
			)
		);

		ipcMain.handle(
			AgentChannels.importWorkspaceEntries,
			wrapAgentHandler(
				workspaceAccess,
				async (destinationDirectoryPath: unknown): Promise<string[]> => {
					if (typeof destinationDirectoryPath !== 'string') {
						throw new Error('Invalid workspace destination path.');
					}
					const window = BrowserWindow.getFocusedWindow();
					const options: Electron.OpenDialogOptions = {
						properties: ['openFile', 'openDirectory', 'multiSelections'],
					};
					const result = await (window
						? dialog.showOpenDialog(window, options)
						: dialog.showOpenDialog(options));
					if (result.canceled) return [];
					return copyIntoWorkspace(
						workspacePath(agent.config),
						destinationDirectoryPath.trim(),
						result.filePaths
					);
				},
				AgentChannels.importWorkspaceEntries
			)
		);

		ipcMain.handle(
			AgentChannels.transferWorkspaceEntry,
			wrapAgentHandler(
				workspaceAccess,
				async (sourcePath: unknown, workspaceId: unknown): Promise<void> => {
					const normalizedSourcePath = optionalTrimmedString(sourcePath);
					if (!normalizedSourcePath) throw new Error('Invalid workspace source path.');
					const target = resolveWorkspace(String(workspaceId));
					if (target.id === agent.config.workspace.id) throw new Error('Choose another workspace.');
					if (!existsSync(target.files)) throw new Error('This workspace folder was not found.');
					return transferWorkspaceEntry(workspacePath(agent.config), normalizedSourcePath, target.files);
				},
				AgentChannels.transferWorkspaceEntry
			)
		);

		ipcMain.handle(
			AgentChannels.moveWorkspaceEntry,
			wrapAgentHandler(
				workspaceAccess,
				async (sourcePath: unknown, destinationDirectoryPath: unknown): Promise<string> => {
					const normalizedSourcePath = optionalTrimmedString(sourcePath);
					if (!normalizedSourcePath) throw new Error('Invalid workspace source path.');
					if (typeof destinationDirectoryPath !== 'string') {
						throw new Error('Invalid workspace destination path.');
					}
					return moveWorkspaceEntry(
						workspacePath(agent.config),
						normalizedSourcePath,
						destinationDirectoryPath.trim()
					);
				},
				AgentChannels.moveWorkspaceEntry
			)
		);

		ipcMain.handle(
			AgentChannels.deleteWorkspaceFile,
			wrapAgentHandler(
				workspaceAccess,
				async (filePath: unknown): Promise<void> => {
					const normalizedFilePath = optionalTrimmedString(filePath);
					if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
					await deleteWorkspaceFile(workspacePath(agent.config), normalizedFilePath);
				},
				AgentChannels.deleteWorkspaceFile
			)
		);

		ipcMain.handle(
			AgentChannels.renameWorkspaceEntry,
			wrapAgentHandler(
				workspaceAccess,
				async (sourcePath: unknown, name: unknown): Promise<string> => {
					const normalizedSourcePath = optionalTrimmedString(sourcePath);
					if (!normalizedSourcePath) throw new Error('Invalid workspace source path.');
					const normalizedName = optionalTrimmedString(name);
					if (!normalizedName) throw new Error('Invalid workspace entry name.');
					return renameWorkspaceEntry(
						workspacePath(agent.config),
						normalizedSourcePath,
						normalizedName
					);
				},
				AgentChannels.renameWorkspaceEntry
			)
		);

		ipcMain.handle(
			AgentChannels.revealWorkspaceEntry,
			wrapAgentHandler(
				workspaceAccess,
				async (entryPath: unknown): Promise<void> => {
					const normalizedEntryPath = optionalTrimmedString(entryPath);
					if (!normalizedEntryPath) throw new Error('Invalid workspace entry path.');
					await revealWorkspaceEntry(workspacePath(agent.config), normalizedEntryPath);
				},
				AgentChannels.revealWorkspaceEntry
			)
		);

		ipcMain.handle(
			AgentChannels.deleteWorkspaceDirectory,
			wrapAgentHandler(
				workspaceAccess,
				async (directoryPath: unknown): Promise<void> => {
					const normalizedDirectoryPath = optionalTrimmedString(directoryPath);
					if (!normalizedDirectoryPath) throw new Error('Invalid workspace folder path.');
					await deleteWorkspaceDirectory(workspacePath(agent.config), normalizedDirectoryPath);
				},
				AgentChannels.deleteWorkspaceDirectory
			)
		);

		ipcMain.handle(
			AgentChannels.getProvider,
			wrapAgentHandler(
				mainAccess,
				(): PublicProvider | undefined => {
					const providerId = getProviderId();
					return providerId ? toPublicProvider(providerId) : undefined;
				},
				AgentChannels.getProvider
			)
		);

		ipcMain.handle(
			AgentChannels.setProvider,
			wrapAgentHandler(
				mainAccess,
				(provider: PublicProvider): boolean => {
					if (!provider.id) return false;
					setProviderId(provider.id);
					return true;
				},
				AgentChannels.setProvider
			)
		);

		ipcMain.handle(
			AgentChannels.getModelId,
			wrapAgentHandler(
				mainAccess,
				(): string | undefined => {
					return getModelId();
				},
				AgentChannels.getModelId
			)
		);

		ipcMain.handle(
			AgentChannels.setModelId,
			wrapAgentHandler(
				mainAccess,
				(modelId: string): boolean => {
					const trimmed = modelId.trim();
					if (!trimmed) return false;
					setModelId(trimmed);
					return true;
				},
				AgentChannels.setModelId
			)
		);

		ipcMain.handle(
			AgentChannels.getModelOptions,
			wrapAgentHandler(mainAccess, () => getModelOptions(), AgentChannels.getModelOptions)
		);
		ipcMain.handle(
			AgentChannels.getModelScope,
			wrapAgentHandler(
				mainAccess,
				() => ({ overridden: isModelOverridden() }),
				AgentChannels.getModelScope
			)
		);
		ipcMain.handle(
			AgentChannels.clearModel,
			wrapAgentHandler(mainAccess, clearModelOverride, AgentChannels.clearModel)
		);
		ipcMain.handle(
			AgentChannels.setModelOptions,
			wrapAgentHandler(
				mainAccess,
				(options: unknown) => {
					if (!isRecord(options)) throw new Error('Invalid model options.');
					setModelOptions(options);
					return getModelOptions();
				},
				AgentChannels.setModelOptions
			)
		);
		ipcMain.handle(
			AgentChannels.getRunBudget,
			wrapAgentHandler(mainAccess, getRunBudget, AgentChannels.getRunBudget)
		);
		ipcMain.handle(
			AgentChannels.setRunBudget,
			wrapAgentHandler(mainAccess, setRunBudget, AgentChannels.setRunBudget)
		);
		ipcMain.handle(
			AgentChannels.getCompactModel,
			wrapAgentHandler(
				mainAccess,
				() =>
					getCompactModel() ?? {
						providerId: '',
						modelId: '',
						options: {},
					},
				AgentChannels.getCompactModel
			)
		);
		ipcMain.handle(
			AgentChannels.setCompactModel,
			wrapAgentHandler(
				mainAccess,
				(settings: unknown) => setCompactModel(toAgentMediaModelSettings(settings)),
				AgentChannels.setCompactModel
			)
		);

		ipcMain.handle(
			AgentChannels.getToolModel,
			wrapAgentHandler(
				mainAccess,
				(kind: unknown, profileId: unknown = 'chat') =>
					getToolModel(toToolModelKind(kind), toToolProfileId(profileId)),
				AgentChannels.getToolModel
			)
		);
		ipcMain.handle(
			AgentChannels.setToolModel,
			wrapAgentHandler(
				mainAccess,
				(kind: unknown, settings: unknown, profileId: unknown = 'chat') => {
					const toolKind = toToolModelKind(kind);
					const toolProfileId = toToolProfileId(profileId);
					const next = toAgentMediaModelSettings(settings);
					setToolModel(toolKind, next, toolProfileId);
					return getToolModel(toolKind, toolProfileId);
				},
				AgentChannels.setToolModel
			)
		);

		ipcMain.handle(
			AgentChannels.getToolProfile,
			wrapAgentHandler(
				mainAccess,
				(profileId: unknown) => {
					const id = toToolProfileId(profileId);
					const profile = getToolProfile(id);
					return {
						...profile,
						tools: {
							...Object.fromEntries(
								modelTools().map((tool) => [
									tool.id,
									getToolConfiguration(id, { kind: 'builtin', id: tool.id }),
								])
							),
							...profile.tools,
						},
					};
				},
				AgentChannels.getToolProfile
			)
		);

		ipcMain.handle(
			AgentChannels.setToolProfileTool,
			wrapAgentHandler(
				mainAccess,
				(profileId: unknown, tool: unknown, settings: unknown) =>
					setToolProfileTool(
						toToolProfileId(profileId),
						toToolReference(tool),
						toToolConfiguration(settings)
					),
				AgentChannels.setToolProfileTool
			)
		);

		ipcMain.handle(
			AgentChannels.policyGet,
			wrapAgentHandler(
				mainAccess,
				(): PermissionsView => permissionsView(getPermissions()),
				AgentChannels.policyGet
			)
		);

		ipcMain.handle(
			AgentChannels.policySet,
			wrapAgentHandler(
				mainAccess,
				async (value: unknown): Promise<PermissionsView> => {
					const permissions = setPermissions(toPermissions(value));
					if (process.platform === 'win32') await agent.sandbox.invalidate();
					return permissionsView(permissions);
				},
				AgentChannels.policySet
			)
		);

		ipcMain.handle(
			AgentChannels.policyReset,
			wrapAgentHandler(
				mainAccess,
				async (): Promise<PermissionsView> => {
					const permissions = resetPermissions();
					if (process.platform === 'win32') await agent.sandbox.invalidate();
					return permissionsView(permissions);
				},
				AgentChannels.policyReset
			)
		);

		ipcMain.handle(
			AgentChannels.policyPickDirectory,
			wrapAgentHandler(
				mainAccess,
				async (): Promise<string | undefined> => {
					const window = BrowserWindow.getFocusedWindow();
					const options = {
						defaultPath: workspacePath(agent.config),
						properties: ['openDirectory' as const],
					};
					const result = await (window
						? dialog.showOpenDialog(window, options)
						: dialog.showOpenDialog(options));
					return result.canceled ? undefined : result.filePaths[0];
				},
				AgentChannels.policyPickDirectory
			)
		);

		ipcMain.handle(
			AgentChannels.policyNormalizeDirectory,
			wrapAgentHandler(
				mainAccess,
				(value: unknown): string => {
					const target = optionalTrimmedString(value);
					if (!target || !path.isAbsolute(target) || /[*?[\]{}]/.test(target)) {
						throw new Error('Choose an absolute folder path without wildcard characters.');
					}
					return realPath(target);
				},
				AgentChannels.policyNormalizeDirectory
			)
		);

		ipcMain.handle(
			AgentChannels.healthSettings,
			wrapAgentHandler(mainAccess, () => getHealthSettings(), AgentChannels.healthSettings)
		);

		ipcMain.handle(
			AgentChannels.healthSaveSettings,
			wrapAgentHandler(
				mainAccess,
				(request: Partial<HealthSettings>) => {
					const next = updateHealthSettings(normalizeHealthSettingsPatch(request));
					rescheduleHealth();
					return next;
				},
				AgentChannels.healthSaveSettings
			)
		);

		ipcMain.handle(
			AgentChannels.healthResetSettings,
			wrapAgentHandler(
				mainAccess,
				() => {
					const next = resetHealthSettings();
					rescheduleHealth();
					return next;
				},
				AgentChannels.healthResetSettings
			)
		);

		ipcMain.handle(
			AgentChannels.healthData,
			wrapAgentHandler(mainAccess, () => getHealth(agent.config), AgentChannels.healthData)
		);

		ipcMain.handle(
			AgentChannels.healthSaveData,
			wrapAgentHandler(
				mainAccess,
				(content: unknown) => {
					if (typeof content !== 'string') throw new Error('Invalid health data content.');
					return updateHealth(agent.config, content);
				},
				AgentChannels.healthSaveData
			)
		);

		ipcMain.handle(
			AgentChannels.ragIndex,
			wrapAgentHandler(
				mainAccess,
				(): Promise<RagIndexResult> => {
					return runRagIndexing();
				},
				AgentChannels.ragIndex
			)
		);

		ipcMain.handle(
			AgentChannels.ragGetStatus,
			wrapAgentHandler(mainAccess, getRagStatus, AgentChannels.ragGetStatus)
		);
		ipcMain.handle(
			AgentChannels.ragCancelIndex,
			wrapAgentHandler(mainAccess, cancelRagIndexing, AgentChannels.ragCancelIndex)
		);

		ipcMain.handle(
			AgentChannels.ragGetConfiguration,
			wrapAgentHandler(
				mainAccess,
				(): RagConfiguration => getRagConfiguration(),
				AgentChannels.ragGetConfiguration
			)
		);

		ipcMain.handle(
			AgentChannels.ragSaveConfiguration,
			wrapAgentHandler(
				mainAccess,
				(configuration: RagConfiguration): RagConfiguration => {
					const saved = saveRagConfiguration(authorizeRagDisclosure(configuration));
					return saved;
				},
				AgentChannels.ragSaveConfiguration
			)
		);

		ipcMain.handle(
			AgentChannels.ragSearch,
			wrapAgentHandler(
				mainAccess,
				(query: unknown, topK: unknown): Promise<RagMatch[]> => {
					const text = optionalTrimmedString(query);
					if (!text) throw new Error('Invalid search query.');
					const configuration = getRagConfiguration();
					if (configuration.enabled !== true) throw new Error('Knowledge is disabled.');
					return searchRag(
						text,
						configuration.indexName,
						typeof topK === 'number' ? topK : undefined
					);
				},
				AgentChannels.ragSearch
			)
		);

		ipcMain.handle(
			AgentChannels.ragPickFolder,
			wrapAgentHandler(
				mainAccess,
				async (): Promise<string | undefined> => {
					const window = BrowserWindow.getFocusedWindow();
					const options = {
						defaultPath: workspacePath(agent.config),
						properties: ['openDirectory' as const],
					};
					const result = await (window
						? dialog.showOpenDialog(window, options)
						: dialog.showOpenDialog(options));
					return result.canceled ? undefined : result.filePaths[0];
				},
				AgentChannels.ragPickFolder
			)
		);

		logger.info('AgentIpc', `Registered ${this.name} module`);
	}
}
