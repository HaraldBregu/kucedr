import type { RagStatus } from '../../../../shared/rag_status';

export const ragJob: Pick<
	RagStatus,
	'running' | 'trigger' | 'startedAt' | 'finishedAt' | 'outcome' | 'error' | 'result'
> & { controller?: AbortController; configuration?: string } = {
	running: false,
	trigger: null,
	startedAt: null,
	finishedAt: null,
	outcome: 'idle',
	error: null,
	result: null,
};
