import { createHash } from 'node:crypto';
import { getProvider } from '../../../settings_store';
import { selectedVectorDatabaseConnection } from '../../../database/vector_connection';
import { EMBEDDING_PROVIDERS } from '../../../models/embedding/embedding_providers';
import type { RagConfiguration } from '../../../../shared/rag_types';

export function ragRecipient(
	kind: 'embedding' | 'mirror',
	providerId: string,
	modelId: string,
	indexName: string,
	configuration: Pick<RagConfiguration, 'databaseProviderId' | 'databaseId'>
): string {
	if (kind === 'mirror') {
		const connection = selectedVectorDatabaseConnection({
			providerId: configuration.databaseProviderId || undefined,
			databaseId: configuration.databaseId || undefined,
		});
		return createHash('sha256')
			.update(JSON.stringify(connection.adapter.consentRecipient(connection.apiKey, indexName)))
			.digest('hex');
	}
	const provider = EMBEDDING_PROVIDERS[providerId];
	const key = getProvider(providerId)?.apiKey.trim();
	if (!provider || provider.local)
		throw new Error('Select a supported remote embedding provider in RAG settings.');
	if (!key)
		throw new Error(`Configure your ${provider.name} API key in Settings → Providers → Models.`);
	return createHash('sha256')
		.update(JSON.stringify([providerId, modelId, provider.url, key]))
		.digest('hex');
}
