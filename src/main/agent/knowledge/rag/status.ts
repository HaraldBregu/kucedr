import type { RagStatus } from '../../../../shared/rag_status';
import { ragJob } from './job';
import { getRagNextRun } from './rag_schedule';
import { getRagConfiguration } from './rag_store';
import { ragVectorStore } from './vector';

export function getRagStatus(): RagStatus {
	const configuration = getRagConfiguration();
	const store = ragVectorStore();
	try {
		const index = store.getIndex(configuration.indexName);
		return {
			running: ragJob.running,
			trigger: ragJob.trigger,
			startedAt: ragJob.startedAt,
			finishedAt: ragJob.finishedAt,
			outcome: ragJob.outcome,
			error: ragJob.error,
			result: ragJob.result ? { ...ragJob.result } : null,
			nextRunAt: getRagNextRun(),
			timezone: configuration.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
			index: index
				? {
						indexName: index.indexName,
						providerId: index.providerId,
						modelId: index.modelId,
						dimensions: index.dimensions,
						completedAt: index.completedAt,
					}
				: null,
		};
	} finally {
		store.close();
	}
}
