import { createHash } from 'node:crypto';
import { findModel } from '../../../models';
import { selectedVectorDatabaseConnection } from '../../../database/vector_connection';
import { embeddingEndpoint } from '../../../models/embedding/endpoint';
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
	if (!findModel(providerId, 'embedding', modelId))
		throw new Error('Select a supported embedding provider in Knowledge settings.');
	const { model, url, apiKey } = embeddingEndpoint(providerId, modelId);
	if (model.location === 'local') {
		return createHash('sha256')
			.update(JSON.stringify([providerId, modelId, url]))
			.digest('hex');
	}
	if (!apiKey && model.authentication !== 'none')
		throw new Error(
			`Configure your ${model.provider.name} API key in Settings → Providers → Models.`
		);
	return createHash('sha256')
		.update(JSON.stringify([providerId, modelId, url, apiKey]))
		.digest('hex');
}
