import { AsyncLocalStorage } from 'node:async_hooks';

export interface ExecutionScope {
	readonly ownerId: string;
	readonly source: 'interactive' | 'task' | 'health' | 'child';
	readonly sessionId: string;
	readonly runId: string;
	readonly profile?: AgentToolProfileId;
}

export const executionScope = new AsyncLocalStorage<ExecutionScope>();
