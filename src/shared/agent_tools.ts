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
	enabled: boolean;
	permission: AgentToolPermission;
}

export type AgentToolReference =
	| { kind: 'builtin'; id: string }
	| { kind: 'mcp'; serverId: string; toolName: string };

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
	return (
		profileId !== 'health' || (tool.kind === 'builtin' && HEALTH_BUILTIN_TOOL_IDS.has(tool.id))
	);
}

export interface AgentToolProfile {
	tools: Record<string, AgentToolConfiguration>;
	mcp: Record<string, Record<string, AgentToolConfiguration>>;
}
