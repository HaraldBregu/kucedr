import type { MessageContentBlock, ToolCall } from '../types';

export interface ModelTurn {
	content: string;
	model: string;
	stopReason?: string;
	toolCalls: ToolCall[];
	usage?: import('../../../shared/agent_types').AgentTokenUsage;
	providerItems?: MessageContentBlock[];
}
