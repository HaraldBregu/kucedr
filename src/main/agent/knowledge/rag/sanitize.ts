import type { RagConfiguration } from '../../../../shared/rag_types';
import { LOCAL_RAG_DATABASE_PROVIDER_ID } from '../../../../shared/rag_types';
import { ragRecipient } from './recipient';

export function sanitizeRagConsent(configuration: RagConfiguration): RagConfiguration {
	const next = { ...configuration };
	for (const kind of ['embedding', 'mirror'] as const) {
		const key = kind === 'embedding' ? 'embeddingConsent' : 'mirrorConsent';
		const consent = next[key];
		try {
			if (
				consent?.version !== 1 ||
				(kind === 'embedding' &&
					(next.embeddingConsent?.providerId !== next.embeddingProviderId ||
						next.embeddingConsent.modelId !== next.embeddingModelId)) ||
				(kind === 'mirror' &&
					(next.databaseProviderId === LOCAL_RAG_DATABASE_PROVIDER_ID ||
						next.mirrorConsent?.indexName !== next.indexName)) ||
				consent.recipient !==
					ragRecipient(
						kind,
						next.embeddingProviderId,
						next.embeddingModelId,
						next.indexName,
						next
					)
			)
				next[key] = null;
		} catch {
			next[key] = null;
		}
	}
	return next;
}
