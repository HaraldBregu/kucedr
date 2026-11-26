import { z } from 'zod';
import path from 'node:path';
import type {
	AgentRunBudget,
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
import { isAgentToolConfigurable } from '../../shared/agent_tools';
import { agentLocation } from '../shared/agent_location';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { currentWorkspace } from '../workspaces/current';
import { resolveWorkspace } from '../workspaces/resolve';
import { getResolvedProvider } from '../settings_store';
import { chatOverride } from './override';
import { storePermissions } from './permissions/store';
import { storedPermissions } from './permissions/stored';
import { migratePermissions } from './permissions/migrate_permissions';
import { normalizePermissionsSchema } from './permissions/normalize_permissions_schema';
import {
	EMPTY_PERMISSIONS,
	type PermissionBucket,
	type PermissionKind,
	type PermissionRule,
	type PermissionsSchema,
} from './permissions/permissions_types';
import { withDefaultPermissions } from './permissions/with_default_permissions';
import { withoutDefaultPermissions } from './permissions/without_default_permissions';
import {
	getAgentProfileDocument,
	getCompactChatModel,
	getAgentProfileModel,
	getAgentProfileTool,
	getAgentProfileTools,
	setAgentProfileDocument,
	setCompactChatModel,
	setAgentProfileModel,
	setAgentProfileTool,
} from './agent_profiles';

export type SearchEngineSettings = {
	providerId: string;
	providerName: string;
	serviceId?: string;
	enabled: boolean;
};

const legacyLibraryRule: PermissionRule = {
	root: path.resolve(resolveWorkspace(DEFAULT_WORKSPACE).library),
	recursive: true,
};
migratePermissions({ root: path.resolve(agentLocation()), recursive: true }, legacyLibraryRule);
const RUNTIME_TOOL_KEYS = {
	subagent: 'subagent',
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
	get_health: 'get_health',
	get_identity: 'get_identity',
	get_soul: 'get_soul',
	update_soul: 'update_soul',
	get_user: 'get_user',
	update_user: 'update_user',
	update_identity: 'update_identity',
	update_health: 'update_health',
	remember: 'remember',
	forget: 'forget',
	create_task: 'create_task',
	update_task: 'update_task',
	delete_task: 'delete_task',
	list_tasks: 'list_tasks',
	run_task_now: 'run_task_now',
	list_skills: 'list_skills',
	load_skill: 'load_skill',
	ask: 'request_user_input',
	complete_bootstrap: 'complete_bootstrap',
} as const;
export const AGENT_RUNTIME_TOOL_IDS = Object.keys(RUNTIME_TOOL_KEYS);
function isSearchEngineSettings(value: unknown): value is SearchEngineSettings {
	if (!value || typeof value !== 'object') return false;
	const settings = value as Partial<SearchEngineSettings>;
	return (
		typeof settings.providerId === 'string' &&
		typeof settings.providerName === 'string' &&
		typeof settings.enabled === 'boolean'
	);
}

function chatModel(): AgentMediaModelSettings {
	const saved = chatOverride()?.get('llm');
	return saved && getResolvedProvider(saved.providerId)
		? structuredClone(saved)
		: getAgentProfileModel('chat', 'textToText');
}
function setChatModel(change: Partial<AgentMediaModelSettings>): void {
	const store = chatOverride();
	if (store) store.set('llm', { ...chatModel(), ...change });
	else setAgentProfileModel('chat', 'textToText', { ...chatModel(), ...change });
}
export function isModelOverridden(): boolean {
	return chatOverride()?.has('llm') === true;
}
export function clearModelOverride(): void {
	chatOverride()?.delete('llm');
}
export function getProviderId(): string | undefined {
	return chatModel().providerId || undefined;
}
export function setProviderId(providerId: string): void {
	setChatModel({ providerId });
}
export function getModelId(): string | undefined {
	return chatModel().modelId || undefined;
}
export function setModelId(modelId: string): void {
	setChatModel({ modelId });
}
export function getModelOptions(): Record<string, unknown> {
	return chatModel().options;
}
export function setModelOptions(options: Record<string, unknown>): void {
	setChatModel({ options });
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

const runBudgetSchema = z.object({
	turns: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
	tokens: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict();

export function getRunBudget(): AgentRunBudget {
	const budget = runBudgetSchema.safeParse(getAgentProfileDocument('chat').runBudget);
	return budget.success ? budget.data : {};
}

export function setRunBudget(value: unknown): AgentRunBudget {
	const budget = runBudgetSchema.parse(value);
	setAgentProfileDocument('chat', { ...getAgentProfileDocument('chat'), runBudget: budget });
	return budget;
}

export function getCompactModel(): AgentMediaModelSettings | undefined {
	const model = getCompactChatModel();
	return model.providerId && model.modelId ? model : undefined;
}

export function setCompactModel(settings: AgentMediaModelSettings): AgentMediaModelSettings {
	return setCompactChatModel(settings);
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
export function getToolModel(
	kind: AgentToolModelKind,
	profileId: AgentToolProfileId = 'chat'
): AgentMediaModelSettings {
	return getAgentProfileModel(profileId, kind);
}
export function setToolModel(
	kind: AgentToolModelKind,
	settings: AgentMediaModelSettings,
	profileId: AgentToolProfileId = 'chat'
): void {
	setAgentProfileModel(profileId, kind, settings);
}
export function getToolProfile(profileId: AgentToolProfileId): AgentToolProfile {
	const profile = getAgentProfileTools(profileId);
	return {
		...profile,
		tools: Object.fromEntries(
			Object.entries(profile.tools).filter(([id]) =>
				isAgentToolConfigurable({ kind: 'builtin', id })
			)
		),
	};
}
export function setToolProfileTool(
	profileId: AgentToolProfileId,
	tool: AgentToolReference,
	settings: AgentToolConfiguration
): AgentToolProfile {
	if (tool.kind === 'builtin') {
		if (!(tool.id in RUNTIME_TOOL_KEYS) && !tool.id.startsWith('mdl__'))
			throw new Error('Unknown built-in tool.');
		if (!isAgentToolConfigurable(tool) && settings.permission !== 'allow') {
			throw new Error('Required system tools cannot be disabled.');
		}
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
	if (!isAgentToolConfigurable(tool)) return { permission: 'allow' };
	return getAgentProfileTool(profileId, tool);
}

export function getPermissions(): PermissionsSchema {
	const workspace = currentWorkspace();
	const workspaceRule: PermissionRule = { root: path.resolve(workspace.files), recursive: true };
	return withDefaultPermissions(
		withoutDefaultPermissions(
			normalizePermissionsSchema(storedPermissions(workspace)).permissions,
			workspaceRule,
			legacyLibraryRule
		),
		workspaceRule
	);
}
export function setPermissions(permissions: PermissionsSchema): PermissionsSchema {
	const workspace = currentWorkspace();
	const stored = withoutDefaultPermissions(normalizePermissionsSchema(permissions).permissions, {
		root: path.resolve(workspace.files),
		recursive: true,
	});
	if (workspace.id === DEFAULT_WORKSPACE) {
		const { droppedRules: _droppedRules, ...document } = getAgentProfileDocument('chat');
		setAgentProfileDocument('chat', { ...document, permissions: stored });
	} else storePermissions(workspace, stored);
	return getPermissions();
}
export function addPermissionRule(
	kind: PermissionKind,
	bucket: PermissionBucket,
	rule: PermissionRule
): void {
	const permissions = getPermissions();
	if (
		permissions[kind][bucket].some(
			(entry) => entry.root === rule.root && entry.recursive === rule.recursive
		)
	)
		return;
	const workspace = currentWorkspace();
	storePermissions(
		workspace,
		withoutDefaultPermissions(
			{
				...permissions,
				[kind]: { ...permissions[kind], [bucket]: [...permissions[kind][bucket], { ...rule }] },
			},
			{ root: path.resolve(workspace.files), recursive: true }
		)
	);
}
export function resetPermissions(): PermissionsSchema {
	return setPermissions(EMPTY_PERMISSIONS);
}
