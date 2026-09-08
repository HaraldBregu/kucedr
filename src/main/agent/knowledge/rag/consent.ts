import type { RagConfiguration } from '../../../../shared/rag_types';
import { ragRecipient } from './recipient';

export function assertRagConsent(
	configuration: RagConfiguration,
	providerId: string,
	modelId: string,
	indexName: string,
	mirror = false
): void {
	const consent = configuration.embeddingConsent;
	if (
		consent?.version !== 1 ||
		consent.providerId !== providerId ||
		consent.modelId !== modelId ||
		consent.recipient !== ragRecipient('embedding', providerId, modelId, indexName, configuration)
	)
		throw new Error(
			'Confirm remote embedding disclosure for document text and search queries in RAG settings.'
		);
	if (mirror) {
		const accepted = configuration.mirrorConsent;
		if (
			accepted?.version !== 1 ||
			accepted.indexName !== indexName ||
			accepted.recipient !== ragRecipient('mirror', providerId, modelId, indexName, configuration)
		)
			throw new Error(
				'Confirm Pinecone plaintext storage and failed-upload cleanup in RAG settings.'
			);
	}
}
