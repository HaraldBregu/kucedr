export const AGENT_TOOL_PROFILE_IDS = ['chat', 'voice', 'tasks', 'health'] as const;

export type AgentToolProfileId = (typeof AGENT_TOOL_PROFILE_IDS)[number];

export const AGENT_PROFILE_MODEL_KEYS = [
	'textToText',
	'textToSpeech',
	'speechToText',
	'realtimeVoice',
	'image',
	'audio',
	'video',
] as const;

export type AgentProfileModelKey = (typeof AGENT_PROFILE_MODEL_KEYS)[number];

export type AgentToolPermission = 'ask' | 'allow' | 'deny';

export interface AgentToolConfiguration {
	permission: AgentToolPermission;
}

export type AgentToolReference =
	{ kind: 'builtin'; id: string } | { kind: 'mcp'; serverId: string; toolName: string };

export const REQUIRED_SYSTEM_TOOL_IDS = new Set([
	'ask',
	'complete_bootstrap',
	'update_identity',
	'update_soul',
	'update_user',
]);

export function isAgentToolConfigurable(tool: AgentToolReference): boolean {
	return tool.kind !== 'builtin' || !REQUIRED_SYSTEM_TOOL_IDS.has(tool.id);
}

const HEALTH_BUILTIN_TOOL_IDS = new Set([
	'read',
	'write',
	'edit',
	'patch',
	'undo',
	'redo',
	'bash',
	'process',
]);

const TASKS_BUILTIN_TOOL_IDS = new Set([
	'read',
	'write',
	'edit',
	'patch',
	'undo',
	'redo',
	'bash',
	'process',
	'search_web',
	'fetch_web_page',
	'use_web_browser',
	'microphone_recorder',
	'microphone_recorder_status',
	'microphone_recorder_stop',
	'camera_recorder',
	'camera_recorder_status',
	'camera_recorder_stop',
	'screen_recorder',
	'select_screen_source',
	'screen_recorder_status',
	'screen_recorder_stop',
	'query_knowledge',
	'list_skills',
	'load_skill',
	'tool_search',
	'load_script',
	'run_script',
	'create_task',
	'update_task',
	'delete_task',
	'list_tasks',
	'run_task_now',
	'subagent',
	'subagents',
]);

const MODEL_BACKED_TOOL_IDS = new Set([
	'create_image',
	'create_video',
	'create_sound',
	'query_knowledge',
]);

export function isAgentToolAllowedForProfile(
	profileId: AgentToolProfileId,
	tool: AgentToolReference
): boolean {
	if (tool.kind !== 'builtin') return profileId !== 'health';
	if (profileId === 'tasks') return TASKS_BUILTIN_TOOL_IDS.has(tool.id);
	if (profileId === 'health') return HEALTH_BUILTIN_TOOL_IDS.has(tool.id);
	if (profileId === 'voice' && (MODEL_BACKED_TOOL_IDS.has(tool.id) || tool.id.startsWith('mdl__')))
		return false;
	if (tool.id === 'ask' || tool.id === 'request_mcp_authorization') return profileId === 'chat';
	return true;
}

export interface AgentToolProfile {
	tools: Record<string, AgentToolConfiguration>;
	mcp: Record<string, Record<string, AgentToolConfiguration>>;
}
