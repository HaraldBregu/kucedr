import type { RagConfiguration } from './rag_types';

export function isLocalRagDatabase(
	configuration: Pick<RagConfiguration, 'databaseProviderId' | 'databaseId'>
): boolean {
	return configuration.databaseProviderId === 'local' && configuration.databaseId === 'sqlite';
}
