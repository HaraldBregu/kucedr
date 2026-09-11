import { typedInvokeUnwrap, typedOn } from '../shared/ipc_types';
import { AgentChannels } from '../shared/ipc_channels_definitions';
import type { AgentApi } from './index.d';
import type { PublicProvider } from '../shared';
import type {
	AgentHistoryMessage,
	AgentPromptInputCapabilities,
	AgentResponseEvent,
	AgentRunOptions,
	AgentSessionSummary,
	AgentToolPermissionDecision,
	AgentToolPermissionScope,
	AgentUserInputAnswer,
	AgentUserInputScope,
	ModelReasoningEffort,
} from '../shared/agent_types';
import { normalizeAgentInputFiles } from '../shared/agent_files';
import type { HealthSettings } from '../main/agent/health/health_types';
import type { RagIndexResult, RagMatch } from '../main/agent/knowledge/rag';
import type { RagConfiguration } from '../shared/rag_types';
import type { PermissionsSchema } from '../main/agent/permissions/permissions_types';
import { optionalStringList, optionalTrimmedString } from './normalize';

const MODEL_REASONING_EFFORTS: readonly ModelReasoningEffort[] = [
	'none',
	'minimal',
	'low',
	'medium',
	'high',
	'xhigh',
];

function isModelReasoningEffort(value: unknown): value is ModelReasoningEffort {
	return MODEL_REASONING_EFFORTS.includes(value as ModelReasoningEffort);
}

function normalizeAgentSendRuntimeOptions(options?: AgentRunOptions): AgentRunOptions | undefined {
	if (!options) return undefined;
	const files = normalizeAgentInputFiles(options.files);
	const normalized: AgentRunOptions = {
		...(optionalTrimmedString(options.runId)
			? { runId: optionalTrimmedString(options.runId) }
			: {}),
		...(optionalTrimmedString(options.sessionId)
			? { sessionId: optionalTrimmedString(options.sessionId) }
			: {}),
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
		interactionMode: options.interactionMode === 'plan' ? 'plan' : 'default',
		...(options.contextMode === 'minimal' || options.contextMode === 'workspace'
			? { contextMode: options.contextMode }
			: typeof options.lightContext === 'boolean'
				? { contextMode: options.lightContext ? 'minimal' : 'workspace' }
				: {}),
		...(optionalStringList(options.toolsAllow)
			? { toolsAllow: optionalStringList(options.toolsAllow) }
			: {}),
		...(optionalStringList(options.toolsDeny)
			? { toolsDeny: optionalStringList(options.toolsDeny) }
			: {}),
		...(files ? { files } : {}),
	};
	return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function sendAgent(
	channel: typeof AgentChannels.send,
	message: string,
	options?: AgentRunOptions,
	onEvent?: (event: AgentResponseEvent) => void
): Promise<string> {
	const runId = optionalTrimmedString(options?.runId) || crypto.randomUUID();
	const runtimeOptions = normalizeAgentSendRuntimeOptions({ ...options, runId });

	const offResponse = typedOn(AgentChannels.response, (event: AgentResponseEvent) => {
		if (event.runId !== runId) return;
		onEvent?.(event);
	});

	return (
		runtimeOptions
			? typedInvokeUnwrap<string>(channel, message, runtimeOptions)
			: typedInvokeUnwrap<string>(channel, message)
	).finally(offResponse);
}

export const agent: AgentApi = {
	send: (
		message: string,
		options?: AgentRunOptions,
		onEvent?: (event: AgentResponseEvent) => void
	): Promise<string> => {
		return sendAgent(AgentChannels.send, message, options, onEvent);
	},
	cancel: (runId: string): Promise<boolean> => {
		const normalizedRunId = optionalTrimmedString(runId);
		if (!normalizedRunId) throw new Error('Invalid assistant run id.');
		return typedInvokeUnwrap(AgentChannels.cancel, normalizedRunId);
	},
	respondToolPermission: (
		scope: AgentToolPermissionScope,
		decision: AgentToolPermissionDecision
	): Promise<boolean> => {
		return typedInvokeUnwrap(AgentChannels.respondToolPermission, scope, decision);
	},
	respondUserInput: (
		scope: AgentUserInputScope,
		answers: AgentUserInputAnswer[]
	): Promise<boolean> => {
		return typedInvokeUnwrap(AgentChannels.respondUserInput, scope, answers);
	},
	getPromptInputCapabilities: (): Promise<AgentPromptInputCapabilities | null> => {
		return typedInvokeUnwrap(AgentChannels.getPromptInputCapabilities);
	},
	listSessions: (): Promise<AgentSessionSummary[]> => {
		return typedInvokeUnwrap(AgentChannels.listSessions);
	},
	openSessionsFolder: (): Promise<void> => {
		return typedInvokeUnwrap(AgentChannels.openSessionsFolder);
	},
	openSessionFolder: (sessionId: string): Promise<void> => {
		const normalizedSessionId = optionalTrimmedString(sessionId);
		if (!normalizedSessionId) throw new Error('Invalid assistant session id.');
		return typedInvokeUnwrap(AgentChannels.openSessionFolder, normalizedSessionId);
	},
	renameSession: (sessionId: string, title: string): Promise<void> => {
		const normalizedSessionId = optionalTrimmedString(sessionId);
		const normalizedTitle = optionalTrimmedString(title);
		if (!normalizedSessionId) throw new Error('Invalid assistant session id.');
		if (!normalizedTitle || normalizedTitle.length > 120)
			throw new Error('Chat title must be between 1 and 120 characters.');
		return typedInvokeUnwrap(AgentChannels.renameSession, normalizedSessionId, normalizedTitle);
	},
	getLastMessages: (sessionId: string): Promise<AgentHistoryMessage[]> => {
		const normalizedSessionId = optionalTrimmedString(sessionId);
		if (!normalizedSessionId) throw new Error('Invalid assistant session id.');
		return typedInvokeUnwrap(AgentChannels.lastMessages, normalizedSessionId);
	},
	getSessionSnapshot: (sessionId) => {
		const normalizedSessionId = optionalTrimmedString(sessionId);
		if (!normalizedSessionId) throw new Error('Invalid assistant session id.');
		return typedInvokeUnwrap(AgentChannels.sessionSnapshot, normalizedSessionId);
	},
	editUserMessage: (
		sessionId: string,
		userOffsetFromEnd: number,
		content: string
	): Promise<boolean> => {
		const normalizedSessionId = optionalTrimmedString(sessionId);
		const normalizedContent = optionalTrimmedString(content);
		if (!normalizedSessionId) throw new Error('Invalid assistant session id.');
		if (!Number.isSafeInteger(userOffsetFromEnd) || userOffsetFromEnd < 0)
			throw new Error('Invalid user message offset.');
		if (!normalizedContent) throw new Error('Invalid user message content.');
		return typedInvokeUnwrap(
			AgentChannels.editUserMessage,
			normalizedSessionId,
			userOffsetFromEnd,
			normalizedContent
		);
	},
	clearMessages: (sessionId: string): Promise<void> => {
		const normalizedSessionId = optionalTrimmedString(sessionId);
		if (!normalizedSessionId) throw new Error('Invalid assistant session id.');
		return typedInvokeUnwrap(AgentChannels.clearMessages, normalizedSessionId);
	},
	deleteSession: (sessionId: string): Promise<void> => {
		const normalizedSessionId = optionalTrimmedString(sessionId);
		if (!normalizedSessionId) throw new Error('Invalid assistant session id.');
		return typedInvokeUnwrap(AgentChannels.deleteSession, normalizedSessionId);
	},
	getWorkspaceLocation: (): Promise<string> => {
		return typedInvokeUnwrap(AgentChannels.getWorkspaceLocation);
	},
	listWorkspaceFiles: () => {
		return typedInvokeUnwrap(AgentChannels.listWorkspaceFiles);
	},
	onWorkspaceChanged: (callback) => {
		return typedOn(AgentChannels.workspaceChanged, callback);
	},
	readWorkspaceFile: (filePath: string): Promise<string> => {
		const normalizedFilePath = optionalTrimmedString(filePath);
		if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
		return typedInvokeUnwrap(AgentChannels.readWorkspaceFile, normalizedFilePath);
	},
	readWorkspaceAsset: (filePath) => {
		const normalizedFilePath = optionalTrimmedString(filePath);
		if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
		return typedInvokeUnwrap(AgentChannels.readWorkspaceAsset, normalizedFilePath);
	},
	writeWorkspaceFile: (filePath, content) => {
		const normalizedFilePath = optionalTrimmedString(filePath);
		if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
		if (typeof content !== 'string') throw new Error('Invalid workspace file content.');
		return typedInvokeUnwrap(AgentChannels.writeWorkspaceFile, normalizedFilePath, content);
	},
	writeWorkspaceMarkdown: (filePath, content) => {
		const normalizedFilePath = optionalTrimmedString(filePath);
		if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
		if (typeof content !== 'string') throw new Error('Invalid workspace file content.');
		return typedInvokeUnwrap(AgentChannels.writeWorkspaceMarkdown, normalizedFilePath, content);
	},
	createWorkspaceFile: (parentPath, name) => {
		if (typeof parentPath !== 'string') throw new Error('Invalid workspace parent path.');
		const normalizedName = optionalTrimmedString(name);
		if (!normalizedName) throw new Error('Invalid workspace file name.');
		return typedInvokeUnwrap(AgentChannels.createWorkspaceFile, parentPath.trim(), normalizedName);
	},
	createWorkspaceDirectory: (parentPath, name) => {
		if (typeof parentPath !== 'string') throw new Error('Invalid workspace parent path.');
		const normalizedName = optionalTrimmedString(name);
		if (!normalizedName) throw new Error('Invalid workspace folder name.');
		return typedInvokeUnwrap(
			AgentChannels.createWorkspaceDirectory,
			parentPath.trim(),
			normalizedName
		);
	},
	moveWorkspaceEntry: (sourcePath, destinationDirectoryPath) => {
		const normalizedSourcePath = optionalTrimmedString(sourcePath);
		if (!normalizedSourcePath) throw new Error('Invalid workspace source path.');
		if (typeof destinationDirectoryPath !== 'string') {
			throw new Error('Invalid workspace destination path.');
		}
		return typedInvokeUnwrap(
			AgentChannels.moveWorkspaceEntry,
			normalizedSourcePath,
			destinationDirectoryPath.trim()
		);
	},
	renameWorkspaceEntry: (sourcePath, name) => {
		const normalizedSourcePath = optionalTrimmedString(sourcePath);
		if (!normalizedSourcePath) throw new Error('Invalid workspace source path.');
		const normalizedName = optionalTrimmedString(name);
		if (!normalizedName) throw new Error('Invalid workspace entry name.');
		return typedInvokeUnwrap(
			AgentChannels.renameWorkspaceEntry,
			normalizedSourcePath,
			normalizedName
		);
	},
	deleteWorkspaceFile: (filePath) => {
		const normalizedFilePath = optionalTrimmedString(filePath);
		if (!normalizedFilePath) throw new Error('Invalid workspace file path.');
		return typedInvokeUnwrap(AgentChannels.deleteWorkspaceFile, normalizedFilePath);
	},
	deleteWorkspaceDirectory: (directoryPath) => {
		const normalizedDirectoryPath = optionalTrimmedString(directoryPath);
		if (!normalizedDirectoryPath) throw new Error('Invalid workspace folder path.');
		return typedInvokeUnwrap(AgentChannels.deleteWorkspaceDirectory, normalizedDirectoryPath);
	},
	getProvider: (): Promise<PublicProvider | undefined> => {
		return typedInvokeUnwrap(AgentChannels.getProvider);
	},
	setProvider: (provider: PublicProvider): Promise<boolean> => {
		return typedInvokeUnwrap(AgentChannels.setProvider, provider);
	},
	getModelId: (): Promise<string | undefined> => {
		return typedInvokeUnwrap(AgentChannels.getModelId);
	},
	setModelId: (modelId: string): Promise<boolean> => {
		return typedInvokeUnwrap(AgentChannels.setModelId, modelId);
	},
	getModelOptions: (): Promise<Record<string, unknown>> => {
		return typedInvokeUnwrap(AgentChannels.getModelOptions);
	},
	setModelOptions: (options: Record<string, unknown>): Promise<Record<string, unknown>> => {
		return typedInvokeUnwrap(AgentChannels.setModelOptions, options);
	},
	getToolModel: (kind) => {
		return typedInvokeUnwrap(AgentChannels.getToolModel, kind);
	},
	setToolModel: (kind, settings) => {
		return typedInvokeUnwrap(AgentChannels.setToolModel, kind, settings);
	},
	policyGet: (): Promise<PermissionsSchema> => {
		return typedInvokeUnwrap(AgentChannels.policyGet);
	},
	policySet: (permissions: PermissionsSchema): Promise<PermissionsSchema> => {
		return typedInvokeUnwrap(AgentChannels.policySet, permissions);
	},
	policyReset: (): Promise<PermissionsSchema> => {
		return typedInvokeUnwrap(AgentChannels.policyReset);
	},
	policyPickDirectory: (): Promise<string | undefined> => {
		return typedInvokeUnwrap(AgentChannels.policyPickDirectory);
	},
	policyNormalizeDirectory: (value: string): Promise<string> => {
		return typedInvokeUnwrap(AgentChannels.policyNormalizeDirectory, value);
	},
	healthGetSettings: (): Promise<HealthSettings> => {
		return typedInvokeUnwrap(AgentChannels.healthSettings);
	},
	healthSaveSettings: (settings: Partial<HealthSettings>): Promise<HealthSettings> => {
		return typedInvokeUnwrap(AgentChannels.healthSaveSettings, settings);
	},
	healthResetSettings: (): Promise<HealthSettings> => {
		return typedInvokeUnwrap(AgentChannels.healthResetSettings);
	},
	healthGetData: (): Promise<string> => {
		return typedInvokeUnwrap(AgentChannels.healthData);
	},
	healthSaveData: (content: string): Promise<string> => {
		return typedInvokeUnwrap(AgentChannels.healthSaveData, content);
	},
	ragIndex: (): Promise<RagIndexResult> => {
		return typedInvokeUnwrap(AgentChannels.ragIndex);
	},
	ragGetConfiguration: (): Promise<RagConfiguration> => {
		return typedInvokeUnwrap(AgentChannels.ragGetConfiguration);
	},
	ragSaveConfiguration: (configuration: RagConfiguration): Promise<RagConfiguration> => {
		return typedInvokeUnwrap(AgentChannels.ragSaveConfiguration, configuration);
	},
	ragSearch: (query: string, topK?: number): Promise<RagMatch[]> => {
		const normalizedQuery = optionalTrimmedString(query);
		if (!normalizedQuery) throw new Error('Invalid search query.');
		return typedInvokeUnwrap(AgentChannels.ragSearch, normalizedQuery, topK);
	},
	ragPickFolder: (): Promise<string | undefined> => {
		return typedInvokeUnwrap(AgentChannels.ragPickFolder);
	},
} satisfies AgentApi;
