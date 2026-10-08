import type { RagConfiguration } from '../../../../shared/rag_types';
import { getRagConfiguration } from './rag_store';

export function assertRagCurrent(configuration: RagConfiguration): void {
	const current = getRagConfiguration();
	if (
		!current.enabled ||
		current.indexName !== configuration.indexName ||
		current.embeddingProviderId !== configuration.embeddingProviderId ||
		current.embeddingModelId !== configuration.embeddingModelId ||
		current.databaseProviderId !== configuration.databaseProviderId ||
		current.databaseId !== configuration.databaseId ||
		JSON.stringify(current.folders) !== JSON.stringify(configuration.folders)
	) {
		throw new Error('Knowledge settings changed. Run indexing again with the selected settings.');
	}
}
