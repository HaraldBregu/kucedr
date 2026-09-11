import { authorizeRagDisclosure } from '../agent/knowledge/rag/disclosure';
import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { watch } from 'chokidar';
import { realPath } from '../shared/real_path';
import type { IpcModule } from './core/module';
import type { EventBus } from '../event_bus';
import { wrapIpcHandler } from './core/error_handler';
import { AgentChannels } from '../../shared/ipc_channels_definitions';
import type { Agent } from '../agent/agent';
import type { Conversation } from '../agent/conversation';
import type { LoggerService } from '../shared';
import type { PublicProvider } from '../../shared/provider_types';
import { loadProviders } from '../models';
import type {
	AgentContextMode,
	AgentRunOptions,
	AgentToolPermissionDecision,
	AgentToolPermissionScope,
	AgentUserInputAnswer,
	AgentUserInputScope,
	ModelReasoningEffort,
	WorkspaceChangeEvent,
	WorkspaceTreeEntry,
} from '../../shared/agent_types';
import { normalizeAgentInputFiles } from '../../shared/agent_files';
import { requireUuidSessionId, sessionPath, sessionsRoot } from '../agent/session';
import { workspacePath } from '../agent/system';
import {
	getPermissions,
	resetPermissions,
	respondToolPermission,
	setPermissions,
	type PermissionRules,
	type PermissionsSchema,
} from '../agent/permissions';
import {
	getHealthSettings,
	resetHealthSettings,
	updateHealthSettings,
} from '../agent/health/health_store';
import { getHealthData, rescheduleHealth, saveHealthData } from '../agent/health';
import type { HealthSettings } from '../agent/health/health_types';
import {
	getModelId,
	getModelOptions,
	getProviderId,
	getToolModel,
	setModelId,
	setModelOptions,
	setProviderId,
	setToolModel,
} from '../agent/agent_store';
import {
	getRagConfiguration,
	indexRag,
	rescheduleRagIndexing,
	saveRagConfiguration,
	searchRag,
	type RagIndexResult,
	type RagMatch,
} from '../agent/knowledge/rag';
import type { RagConfiguration } from '../../shared/rag_types';
import type { WorkspaceAsset } from '../../shared/workspace';
import { readWorkspaceAsset } from './asset';
import { createWorkspaceEntry } from './create';
import { deleteWorkspaceFile } from './delete';
import { deleteWorkspaceDirectory } from './directory';
import { writeWorkspaceMarkdown } from './markdown';
import { writeWorkspaceFile } from './write';
import { moveWorkspaceEntry } from './move';
import { renameWorkspaceEntry } from './rename';
import { readWorkspaceTree } from './tree';
import { resolveWorkspaceFile } from './workspace';
import { respondUserInput } from '../agent/user_input/user_input_pending';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import type { IpcResult } from '../../shared/ipc_types';
import { AgentRenderer } from './core/agent_renderer';

export interface AgentIpcDeps {
	logger: LoggerService;
	agent: Agent;
	conversation: Conversation;
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

function toPermissionRules(value: unknown): PermissionRules {
	if (!isRecord(value)) throw new Error('Invalid permission rules.');
	const list = (input: unknown): string[] => {
		if (!Array.isArray(input)) throw new Error('Invalid permission rules.');
		return [...new Set(input.map(optionalTrimmedString).filter((item): item is string => !!item))];
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

function isModelReasoningEffort(value: unknown): value is ModelReasoningEffort {
	return MODEL_REASONING_EFFORTS.includes(value as ModelReasoningEffort);
}

function toPublicProvider(providerId: string): PublicProvider | undefined {
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
	if (options === undefined || options === null) return { interactionMode: 'default' };
	if (!isRecord(options)) throw new Error('Invalid assistant runtime options.');

	const sessionId =
		optionalTrimmedString(options.sessionId) ?? optionalTrimmedString(options.agentRuntime);
	const files = normalizeAgentInputFiles(options.files);
	return {
		interactionMode: options.interactionMode === 'plan' ? 'plan' : 'default',
		...(optionalTrimmedString(options.runId)
			? { runId: optionalTrimmedString(options.runId) }
			: {}),
		...(sessionId ? { sessionId } : {}),
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

	register({ logger, agent, conversation, windows, apps }: AgentIpcDeps, eventBus: EventBus): void {
		const renderer = new AgentRenderer(windows, apps);
		const mainAccess = renderer.assert.bind(renderer);
		const workspaceAccess = renderer.assertWorkspace.bind(renderer);
		let watcherStarted = false;
		const startWorkspaceWatcher = (root: string): void => {
			if (watcherStarted) return;
			watcherStarted = true;
			const watcher = watch(root, {
				ignoreInitial: true,
				awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 25 },
			});
			for (const type of ['add', 'change', 'unlink', 'addDir', 'unlinkDir'] as const) {
				watcher.on(type, (changedPath) => {
					const event: WorkspaceChangeEvent = {
						type,
						path: path.relative(root, changedPath),
					};
					eventBus.broadcast(AgentChannels.workspaceChanged, event);
				});
			}
		};

		ipcMain.handle(
			AgentChannels.send,
			wrapIpcHandler(async (event, message: string, options?: unknown): Promise<string> => {
				const window = renderer.assert(event);
				return conversation.execute({
					type: 'text',
					message,
					agentId: 'main',
					options: {
						...normalizeAgentSendRuntimeOptions(options),
						type: 'default',
						windowId: window.id,
						streamEvent: (responseEvent) =>
							eventBus.sendTo(window.id, AgentChannels.response, responseEvent),
					},
				});
			}, AgentChannels.send)
		);

		ipcMain.handle(
			AgentChannels.respondUserInput,
			wrapIpcHandler((event, value: unknown, answers: unknown): boolean => {
				const window = renderer.assert(event);
				return respondUserInput(toUserInputScope(value), toUserInputAnswers(answers), window.id);
			}, AgentChannels.respondUserInput)
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
			wrapAgentHandler(mainAccess, () => agent.listSessions(), AgentChannels.listSessions)
		);

		ipcMain.handle(
			AgentChannels.openSessionsFolder,
			wrapAgentHandler(
				mainAccess,
				async (): Promise<void> => {
					const root = sessionsRoot(agent.config.location);
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
					const root = sessionsRoot(agent.config.location);
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
			AgentChannels.editUserMessage,
			wrapAgentHandler(
				mainAccess,
				(sessionId: unknown, userOffsetFromEnd: unknown, content: unknown): Promise<boolean> => {
					if (!Number.isSafeInteger(userOffsetFromEnd) || Number(userOffsetFromEnd) < 0)
						throw new Error('Invalid user message offset.');
					const normalizedContent = optionalTrimmedString(content);
					if (!normalizedContent) throw new Error('Invalid user message content.');
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
					const root = workspacePath(agent.config);
					const resolvedPath = await resolveWorkspaceFile(root, normalizedFilePath);
					const stats = await fs.stat(resolvedPath);
					if (!stats.isFile()) throw new Error('Workspace path is not a file.');
					return fs.readFile(resolvedPath, 'utf8');
				},
				AgentChannels.readWorkspaceFile
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
			AgentChannels.getToolModel,
			wrapAgentHandler(
				mainAccess,
				(kind: unknown) => getToolModel(toToolModelKind(kind)),
				AgentChannels.getToolModel
			)
		);
		ipcMain.handle(
			AgentChannels.setToolModel,
			wrapAgentHandler(
				mainAccess,
				(kind: unknown, settings: unknown) => {
					const toolKind = toToolModelKind(kind);
					const next = toAgentMediaModelSettings(settings);
					setToolModel(toolKind, next);
					return getToolModel(toolKind);
				},
				AgentChannels.setToolModel
			)
		);

		ipcMain.handle(
			AgentChannels.policyGet,
			wrapAgentHandler(
				mainAccess,
				(): PermissionsSchema => getPermissions(),
				AgentChannels.policyGet
			)
		);

		ipcMain.handle(
			AgentChannels.policySet,
			wrapAgentHandler(
				mainAccess,
				async (value: unknown): Promise<PermissionsSchema> => {
					const permissions = setPermissions(toPermissions(value));
					await agent.sandbox.invalidate();
					return permissions;
				},
				AgentChannels.policySet
			)
		);

		ipcMain.handle(
			AgentChannels.policyReset,
			wrapAgentHandler(
				mainAccess,
				async (): Promise<PermissionsSchema> => {
					const permissions = resetPermissions();
					await agent.sandbox.invalidate();
					return permissions;
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
					if (!target || !path.isAbsolute(target) || /[*?[\]]/.test(target)) {
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
			wrapAgentHandler(mainAccess, () => getHealthData(agent.config), AgentChannels.healthData)
		);

		ipcMain.handle(
			AgentChannels.healthSaveData,
			wrapAgentHandler(
				mainAccess,
				(content: unknown) => {
					if (typeof content !== 'string') throw new Error('Invalid health data content.');
					return saveHealthData(agent.config, content);
				},
				AgentChannels.healthSaveData
			)
		);

		ipcMain.handle(
			AgentChannels.ragIndex,
			wrapAgentHandler(
				mainAccess,
				(): Promise<RagIndexResult> => {
					const configuration = getRagConfiguration();
					if (configuration.enabled !== true) throw new Error('Knowledge Base is disabled.');
					return indexRag(configuration.folders, configuration.indexName);
				},
				AgentChannels.ragIndex
			)
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
					const current = getRagConfiguration();
					const saved = saveRagConfiguration(
						authorizeRagDisclosure({
							...configuration,
							databaseProviderId: current.databaseProviderId,
							databaseId: current.databaseId,
							embeddingProviderId: current.embeddingProviderId,
							embeddingModelId: current.embeddingModelId,
						})
					);
					rescheduleRagIndexing();
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
					if (configuration.enabled !== true) throw new Error('Knowledge Base is disabled.');
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
