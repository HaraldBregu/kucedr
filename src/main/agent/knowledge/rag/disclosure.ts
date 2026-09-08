import type { RagConfiguration } from '../../../../shared/rag_types';
import { ragRecipient } from './recipient';

export function authorizeRagDisclosure(configuration: RagConfiguration): RagConfiguration {
	const next = { ...configuration };
	const embedding = next.embeddingConsent;
	if (embedding?.version === 1 && !embedding.recipient) {
		if (
			embedding.providerId !== next.embeddingProviderId ||
			embedding.modelId !== next.embeddingModelId
		)
			throw new Error('Select the embedding provider and model before granting disclosure.');
		next.embeddingConsent = {
			...embedding,
			recipient: ragRecipient(
				'embedding',
				next.embeddingProviderId,
				next.embeddingModelId,
				next.indexName,
				next
			),
		};
	}
	const mirror = next.mirrorConsent;
	if (mirror?.version === 1 && !mirror.recipient) {
		if (mirror.indexName !== next.indexName)
			throw new Error('Select the index before granting Pinecone storage.');
		next.mirrorConsent = {
			...mirror,
			recipient: ragRecipient(
				'mirror',
				next.embeddingProviderId,
				next.embeddingModelId,
				next.indexName,
				next
			),
		};
	}
	return next;
}
