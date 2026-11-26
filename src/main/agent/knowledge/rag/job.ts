import type { RagStatus } from '../../../../shared/rag_status';
import { currentWorkspace } from '../../../workspaces/current';

type RagJob = Pick<
	RagStatus,
	'running' | 'trigger' | 'startedAt' | 'finishedAt' | 'outcome' | 'error' | 'result' | 'progress'
> & { controller?: AbortController; configuration?: string };

const jobs = new Map<string, RagJob>();

export function ragJob(): RagJob {
	const { id } = currentWorkspace();
	let job = jobs.get(id);
	if (!job) {
		job = {
			running: false,
			trigger: null,
			startedAt: null,
			finishedAt: null,
			outcome: 'idle',
			error: null,
			result: null,
			progress: null,
		};
		jobs.set(id, job);
	}
	return job;
}
