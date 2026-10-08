import type { RagStatus } from '../../../../shared/rag_status';
import { ragJob } from './job';
import { getRagNextRun } from './rag_schedule';
import { getRagConfiguration } from './rag_store';
import { ragVectorStore } from './vector';
import { readRagManifest } from './rag_manifest';
import { ragRecipient } from './recipient';

export function getRagStatus(): RagStatus {
	const configuration = getRagConfiguration();
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
			running: ragJob.running,
			trigger: ragJob.trigger,
			startedAt: ragJob.startedAt,
			finishedAt: ragJob.finishedAt,
			outcome: ragJob.outcome,
			error: ragJob.error,
			result: ragJob.result ? { ...ragJob.result } : null,
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
