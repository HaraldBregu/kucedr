import type { RagStatus } from '../../../../shared/rag_status';
import { ragJob } from './job';
import { getRagNextRun } from './rag_schedule';
import { getRagConfiguration } from './rag_store';
import { ragVectorStore } from './vector';
import { readRagManifest } from './rag_manifest';
import { ragRecipient } from './recipient';

export function getRagStatus(): RagStatus {
	const configuration = getRagConfiguration();
	const job = ragJob();
	const store = ragVectorStore();
	try {
		const index = store.getIndex(configuration.indexName);
		const manifest = readRagManifest(configuration.indexName);
		let requiresIndexing = Boolean(
			index &&
			(index.providerId !== configuration.embeddingProviderId ||
				index.modelId !== configuration.embeddingModelId)
		);
		if (index && manifest?.activeNamespace === index.generation) {
			try {
				requiresIndexing ||= Boolean(
					(manifest.embeddingRecipient &&
						manifest.embeddingRecipient !==
							ragRecipient(
								'embedding',
								index.providerId,
								index.modelId,
								configuration.indexName,
								configuration
							)) ||
					(manifest.folders &&
						JSON.stringify(manifest.folders) !== JSON.stringify(configuration.folders))
				);
			} catch {
				requiresIndexing = true;
			}
		}
		return {
			running: job.running,
			trigger: job.trigger,
			startedAt: job.startedAt,
			finishedAt: job.finishedAt,
			outcome: job.outcome,
			error: job.error,
			result: job.result ? { ...job.result } : null,
			progress: job.progress ? { ...job.progress } : null,
			nextRunAt: getRagNextRun(),
			timezone: configuration.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
			requiresIndexing,
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
