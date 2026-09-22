import path from 'node:path';
import Store from 'electron-store';
import type {
	AgentChatbotModelKind,
	AgentMediaModelSettings,
	AgentToolModelKind,
	AgentVoiceModelKind,
} from '../../shared/agent_types';
import type {
	AgentToolConfiguration,
	AgentToolProfile,
	AgentToolProfileId,
	AgentToolReference,
} from '../../shared/agent_tools';
import { agentLocation } from '../shared/agent_location';
import { userDataLocation } from '../shared/user_data_location';
import { normalizePermissionsSchema } from './permissions/normalize_permissions_schema';
import {
	type PermissionBucket,
	type PermissionKind,
	type PermissionsSchema,
	type ToolConfiguration,
} from './permissions/permissions_types';
import { withWorkspacePermissions } from './permissions/with_workspace_permissions';
import {
	getAgentProfileDocument,
	getAgentProfileModel,
	getAgentProfilePermissions,
	getAgentProfileTool,
	getAgentProfileTools,
	setAgentProfileDocument,
	setAgentProfileModel,
	setAgentProfilePermissions,
	setAgentProfileTool,
} from './agent_profiles';

export type SearchEngineSettings = {
	providerId: string;
	providerName: string;
	enabled: boolean;
};

type MediaStore = Record<AgentToolModelKind, AgentMediaModelSettings>;

export const AGENT_DIRECTORY = path.resolve(agentLocation());
const settingsDirectory = path.resolve(userDataLocation(), 'settings');
const workspacePattern = `${AGENT_DIRECTORY.replaceAll(path.sep, '/')}/**`;
const DEFAULT_AGENT_PERMISSIONS: PermissionsSchema = {
	read: { allow: [workspacePattern], deny: [] },
	write: { allow: [workspacePattern], deny: [] },
	exec: { allow: [workspacePattern], deny: [] },
};
const EMPTY_MEDIA_MODEL: AgentMediaModelSettings = { providerId: '', modelId: '', options: {} };
const mediaStore = new Store<MediaStore>({
	name: 'models',
	cwd: settingsDirectory,
	accessPropertiesByDotNotation: false,
	defaults: { image: EMPTY_MEDIA_MODEL, audio: EMPTY_MEDIA_MODEL, video: EMPTY_MEDIA_MODEL },
});

function isSearchEngineSettings(value: unknown): value is SearchEngineSettings {
	if (!value || typeof value !== 'object') return false;
	const settings = value as Partial<SearchEngineSettings>;
	return (
		typeof settings.providerId === 'string' &&
		typeof settings.providerName === 'string' &&
		typeof settings.enabled === 'boolean'
	);
}

export function getProviderId(): string | undefined {
	return getAgentProfileModel('chat', 'textToText').providerId || undefined;
}
export function setProviderId(providerId: string): void {
	setAgentProfileModel('chat', 'textToText', {
		...getAgentProfileModel('chat', 'textToText'),
		providerId,
	});
}
export function getModelId(): string | undefined {
	return getAgentProfileModel('chat', 'textToText').modelId || undefined;
}
export function setModelId(modelId: string): void {
	setAgentProfileModel('chat', 'textToText', {
		...getAgentProfileModel('chat', 'textToText'),
		modelId,
	});
}
export function getModelOptions(): Record<string, unknown> {
	return getAgentProfileModel('chat', 'textToText').options;
}
export function setModelOptions(options: Record<string, unknown>): void {
	setAgentProfileModel('chat', 'textToText', {
		...getAgentProfileModel('chat', 'textToText'),
		options,
	});
}
export function getChatbotModel(kind: AgentChatbotModelKind): AgentMediaModelSettings {
	return getAgentProfileModel('chat', kind);
}
export function setChatbotModel(
	kind: AgentChatbotModelKind,
	settings: AgentMediaModelSettings
): void {
	setAgentProfileModel('chat', kind, settings);
}

export function getSearchEngine(): SearchEngineSettings {
	const value = getAgentProfileDocument('chat').webSearch;
	return isSearchEngineSettings(value)
		? { ...value }
		: { providerId: '', providerName: '', enabled: false };
}
export function setSearchEngine(searchEngine: SearchEngineSettings): void {
	setAgentProfileDocument('chat', {
		...getAgentProfileDocument('chat'),
		webSearch: { ...searchEngine },
	});
}
export function getVoiceModel(kind: AgentVoiceModelKind): AgentMediaModelSettings {
	return getAgentProfileModel('voice', kind);
}
export function setVoiceModel(kind: AgentVoiceModelKind, settings: AgentMediaModelSettings): void {
	setAgentProfileModel('voice', kind, settings);
}
export function getToolModel(kind: AgentToolModelKind): AgentMediaModelSettings {
	return structuredClone(mediaStore.get(kind));
}
export function setToolModel(kind: AgentToolModelKind, settings: AgentMediaModelSettings): void {
	mediaStore.set(kind, structuredClone(settings));
}
export function getToolProfile(profileId: AgentToolProfileId): AgentToolProfile {
	return getAgentProfileTools(profileId);
}
export function setToolProfileTool(
	profileId: AgentToolProfileId,
	tool: AgentToolReference,
	settings: AgentToolConfiguration
): AgentToolProfile {
	if (tool.kind === 'builtin') {
		if (!(tool.id in RUNTIME_TOOL_KEYS)) throw new Error('Unknown built-in tool.');
		return setAgentProfileTool(profileId, tool, settings);
	}
	const serverId = tool.serverId.trim();
	const toolName = tool.toolName.trim();
	if (!serverId || !toolName) throw new Error('Invalid MCP tool.');
	return setAgentProfileTool(profileId, { kind: 'mcp', serverId, toolName }, settings);
}
export function getToolConfiguration(
	profileId: AgentToolProfileId,
	tool: AgentToolReference
): AgentToolConfiguration {
	return getAgentProfileTool(profileId, tool);
}

export function getPermissions(profileId: AgentToolProfileId = 'chat'): PermissionsSchema {
	const permissions = withWorkspacePermissions(
		normalizePermissionsSchema(getAgentProfilePermissions(profileId), DEFAULT_AGENT_PERMISSIONS),
		workspacePattern
	);
	return {
		...permissions,
		tools: getAgentProfileTools(profileId).tools,
	};
}
export function setPermissions(
	permissions: PermissionsSchema,
	profileId: AgentToolProfileId = 'chat'
): PermissionsSchema {
	const { tools, ...directoryPermissions } = permissions;
	setAgentProfilePermissions(
		profileId,
		withWorkspacePermissions(
		normalizePermissionsSchema(directoryPermissions, DEFAULT_AGENT_PERMISSIONS),
		workspacePattern
		)
	);
	if (tools) {
		for (const [toolId, settings] of Object.entries(tools)) {
			setAgentProfileTool(profileId, { kind: 'builtin', id: toolId }, settings);
		}
	}
	return getPermissions(profileId);
}
export function addPermissionRule(
	kind: PermissionKind,
	bucket: PermissionBucket,
	rule: string,
	profileId: AgentToolProfileId = 'chat'
): void {
	const permissions = getPermissions(profileId);
	if (permissions[kind][bucket].includes(rule)) return;
	setPermissions({
		...permissions,
		[kind]: { ...permissions[kind], [bucket]: [...permissions[kind][bucket], rule] },
	}, profileId);
}
export function resetPermissions(profileId: AgentToolProfileId = 'chat'): PermissionsSchema {
	setAgentProfilePermissions(profileId, structuredClone(DEFAULT_AGENT_PERMISSIONS));
	setAgentProfileDocument(profileId, {
		...getAgentProfileDocument(profileId),
		tools: {},
	});
	return getPermissions(profileId);
}
