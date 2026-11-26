import type { AgentFollowUp, AgentResponseEvent, AgentRunStopReason } from '../../../shared/agent_types';
import type { SessionCategory, SessionResult, SessionState } from '../session';

export interface AgentRunOutcome {
	text: string;
	stopReason: AgentRunStopReason;
	result?: SessionResult;
}

export interface AgentRunRequest<TOptions = unknown> {
	readonly id: string;
	readonly agentId: string;
	readonly sessionId: string;
	readonly category: SessionCategory;
	readonly message: string;
	readonly options: TOptions;
	readonly queuedAt: number;
	readonly workspaceId: string;
	readonly windowId?: number;
}

export type AgentRunLifecycle =
	| { status: 'queued' }
	| { status: 'running'; session: SessionState }
	| { status: 'cancelling'; reason: Error; session?: SessionState };

export interface AgentRunRecord<TOptions = unknown> {
	readonly request: Readonly<AgentRunRequest<TOptions>>;
	readonly controller: AbortController;
	readonly responseEvents: AgentResponseEvent[];
	readonly followUps: AgentFollowUp[];
	lifecycle: AgentRunLifecycle;
	completion?: Promise<AgentRunOutcome>;
}

export type AgentRunRegistry<TOptions = unknown> = Map<string, AgentRunRecord<TOptions>>;
