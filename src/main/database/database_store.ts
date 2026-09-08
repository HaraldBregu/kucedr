import type { CatalogService } from '../../shared/provider_types';
import type { DatabaseConfiguration } from '../../shared/database_types';
import { loadDatabases } from '../models';
import {
	getRagConfiguration,
	ragConfigurationStorePath,
	saveRagConfiguration,
} from '../agent/knowledge/rag/rag_store';

const DEFAULT_CONFIGURATION: DatabaseConfiguration = {
	providerId: undefined,
	databaseId: undefined,
};

export const databaseConfigurationStorePath = ragConfigurationStorePath;

export function getDatabaseConfiguration(): DatabaseConfiguration {
	const ragConfiguration = getRagConfiguration();
	const configuration = {
		...DEFAULT_CONFIGURATION,
		providerId: ragConfiguration.databaseProviderId || undefined,
		databaseId: ragConfiguration.databaseId || undefined,
	};
	if (configuration.databaseId && !findDatabase(configuration)) {
		configuration.providerId = undefined;
		configuration.databaseId = undefined;
	}
	return configuration;
}

export function saveDatabaseConfiguration(
	configuration: DatabaseConfiguration
): DatabaseConfiguration {
	if (configuration.databaseId && !findDatabase(configuration)) {
		throw new Error(`Database not found: ${configuration.databaseId}`);
	}
	const saved: DatabaseConfiguration = {
		providerId: configuration.providerId,
		databaseId: configuration.databaseId,
	};
	const current = getRagConfiguration();
	saveRagConfiguration({
		...current,
		databaseProviderId: saved.providerId ?? '',
		databaseId: saved.databaseId ?? '',
		mirrorConsent:
			current.databaseProviderId === (saved.providerId ?? '') &&
			current.databaseId === (saved.databaseId ?? '')
				? current.mirrorConsent
				: null,
	});
	return saved;
}

function findDatabase(configuration: DatabaseConfiguration): CatalogService | undefined {
	return loadDatabases().find(
		(entry) =>
			entry.id === configuration.databaseId && entry.provider.id === configuration.providerId
	);
}
