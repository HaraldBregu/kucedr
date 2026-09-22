export const AGENT_TOOL_PROFILE_IDS = ['chat', 'voice', 'tasks', 'health', 'channels'] as const;

export type AgentToolProfileId = (typeof AGENT_TOOL_PROFILE_IDS)[number];

export type AgentToolPermission = 'ask' | 'allow' | 'deny';

export interface AgentToolConfiguration {
	enabled: boolean;
	permission: AgentToolPermission;
}

export type AgentToolReference =
	| { kind: 'builtin'; id: string }
	| { kind: 'mcp'; serverId: string; toolName: string };

export interface AgentToolProfile {
	tools: Record<string, AgentToolConfiguration>;
	mcp: Record<string, Record<string, AgentToolConfiguration>>;
}
