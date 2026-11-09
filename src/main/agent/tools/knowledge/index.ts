import { getRagConfiguration } from '../../knowledge/rag';
import { assertRagConsent } from '../../knowledge/rag/consent';
import type { Tool } from '../../types';
import { queryKnowledgeTool } from './query_knowledge';

export function getKnowledgeTools(): Tool[] {
	const configuration = getRagConfiguration();
	if (configuration.enabled !== true) return [];
	try {
		assertRagConsent(
			configuration,
			configuration.embeddingProviderId,
			configuration.embeddingModelId,
			configuration.indexName
		);
	} catch {
		return [];
	}
	return [queryKnowledgeTool];
}
