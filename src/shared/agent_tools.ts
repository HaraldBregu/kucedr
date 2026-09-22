export const AGENT_TOOL_PROFILE_IDS = ['chat', 'voice', 'tasks', 'health', 'channels'] as const;

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

export const REQUIRED_SYSTEM_TOOL_IDS = new Set(['ask', 'complete_bootstrap']);

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

export function isAgentToolAllowedForProfile(
	profileId: AgentToolProfileId,
	tool: AgentToolReference
): boolean {
	if (tool.kind === 'builtin' && tool.id === 'ask') return profileId === 'chat';
	if (tool.kind === 'builtin' && tool.id === 'complete_bootstrap') {
		return profileId === 'chat' || profileId === 'voice';
	}
	return (
		profileId !== 'health' || (tool.kind === 'builtin' && HEALTH_BUILTIN_TOOL_IDS.has(tool.id))
	);
}

export interface AgentToolProfile {
	tools: Record<string, AgentToolConfiguration>;
	mcp: Record<string, Record<string, AgentToolConfiguration>>;
}
