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
	getAgentProfileTool,
	getAgentProfileTools,
	setAgentProfileDocument,
	setAgentProfileModel,
	setAgentProfileTool,
} from './agent_profiles';

export type SearchEngineSettings = {
	providerId: string;
	providerName: string;
	enabled: boolean;
};

type PermissionsStore = {
	permissions: PermissionsSchema;
	tools: Record<string, ToolConfiguration>;
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
const RUNTIME_TOOL_KEYS = {
	list_a2a_agents: 'list_remote_agents',
	delegate_a2a: 'delegate_to_remote_agent',
	get_a2a_task: 'get_remote_task',
	cancel_a2a_task: 'cancel_remote_task',
	subagent: 'subagent',
	subagents: 'subagents',
	read: 'read_file',
	write: 'write_file',
	edit: 'edit_file',
	patch: 'apply_patch',
	undo: 'undo_file_operation',
	redo: 'redo_file_operation',
	bash: 'execute_command',
	process: 'manage_process',
	search_web: 'search_web',
	fetch_web_page: 'fetch_web_page',
	use_web_browser: 'use_web_browser',
	create_image: 'create_image',
	create_video: 'create_video',
	create_sound: 'create_sound',
	microphone_recorder: 'microphone_recorder',
	microphone_recorder_status: 'microphone_recorder_status',
	microphone_recorder_stop: 'microphone_recorder_stop',
	camera_recorder: 'camera_recorder',
	camera_recorder_status: 'camera_recorder_status',
	camera_recorder_stop: 'camera_recorder_stop',
	screen_recorder: 'screen_recorder',
	select_screen_source: 'select_screen_source',
	screen_recorder_status: 'screen_recorder_status',
	screen_recorder_stop: 'screen_recorder_stop',
	query_knowledge: 'query_knowledge',
	create_task: 'create_task',
	update_task: 'update_task',
	delete_task: 'delete_task',
	list_tasks: 'list_tasks',
	run_task_now: 'run_task_now',
	list_skills: 'list_skills',
	load_skill: 'load_skill',
	get_goal: 'get_goal',
	update_goal_plan: 'update_goal_plan',
	record_goal_evidence: 'record_goal_evidence',
	request_goal_completion: 'request_goal_completion',
	report_goal_blocker: 'report_goal_blocker',
	ask: 'request_user_input',
	update_health: 'update_health',
	update_health_settings: 'update_health_settings',
	complete_bootstrap: 'complete_bootstrap',
} as const;
const DEFAULT_RUNTIME_TOOL_SETTINGS: Record<string, ToolConfiguration> = Object.fromEntries(
	Object.values(RUNTIME_TOOL_KEYS).map((key) => [key, { enabled: true, permission: 'allow' }])
);
const permissionsStore = new Store<PermissionsStore>({
	name: 'permissions',
	cwd: settingsDirectory,
	accessPropertiesByDotNotation: false,
	defaults: { permissions: DEFAULT_AGENT_PERMISSIONS, tools: DEFAULT_RUNTIME_TOOL_SETTINGS },
});
const mediaStore = new Store<MediaStore>({
	name: 'media',
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

export function getPermissions(): PermissionsSchema {
	const permissions = withWorkspacePermissions(
		normalizePermissionsSchema(permissionsStore.get('permissions'), DEFAULT_AGENT_PERMISSIONS),
		workspacePattern
	);
	const tools = permissionsStore.get('tools');
	return {
		...permissions,
		tools: Object.fromEntries(
			Object.entries(RUNTIME_TOOL_KEYS).map(([toolId, key]) => [
				toolId,
				{ ...(tools[key] ?? DEFAULT_RUNTIME_TOOL_SETTINGS[key]) },
			])
		),
	};
}
export function setPermissions(permissions: PermissionsSchema): PermissionsSchema {
	const { tools, ...directoryPermissions } = permissions;
	permissionsStore.set(
		'permissions',
		withWorkspacePermissions(
			normalizePermissionsSchema(directoryPermissions, DEFAULT_AGENT_PERMISSIONS),
			workspacePattern
		)
	);
	if (tools) {
		const storedTools = permissionsStore.get('tools');
		permissionsStore.set(
			'tools',
			Object.fromEntries(
				Object.entries(RUNTIME_TOOL_KEYS).map(([toolId, key]) => [
					key,
					{ ...(storedTools[key] ?? DEFAULT_RUNTIME_TOOL_SETTINGS[key]), ...(tools[toolId] ?? {}) },
				])
			)
		);
	}
	return getPermissions();
}
export function addPermissionRule(
	kind: PermissionKind,
	bucket: PermissionBucket,
	rule: string
): void {
	const permissions = getPermissions();
	if (permissions[kind][bucket].includes(rule)) return;
	setPermissions({
		...permissions,
		[kind]: { ...permissions[kind], [bucket]: [...permissions[kind][bucket], rule] },
	});
}
export function resetPermissions(): PermissionsSchema {
	permissionsStore.set('permissions', DEFAULT_AGENT_PERMISSIONS);
	permissionsStore.set('tools', DEFAULT_RUNTIME_TOOL_SETTINGS);
	return getPermissions();
}
