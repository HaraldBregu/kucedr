import type { RagConfiguration } from '../../../../shared/rag_types';
import { getProvider } from '../../../settings_store';

export function ragDatabaseKey(
	configuration: Pick<RagConfiguration, 'databaseProviderId' | 'databaseId'>
): string {
	const { databaseProviderId, databaseId } = configuration;
	if (!databaseProviderId || !databaseId)
		throw new Error('Select a vector database in RAG settings before enabling remote storage.');
	if (databaseProviderId !== 'pinecone' || databaseId !== 'pinecone')
		throw new Error('The selected vector database is not supported by RAG.');
	const apiKey = getProvider(databaseProviderId, 'databases')?.apiKey.trim();
	if (!apiKey)
		throw new Error('Configure your Pinecone API key in Settings → Providers → Database.');
	return apiKey;
}
