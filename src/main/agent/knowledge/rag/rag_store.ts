import path from 'node:path';
import { existsSync } from 'node:fs';
import Store from 'electron-store';
import cron from 'node-cron';
import { sanitizeRagConsent } from './sanitize';
import { supportsVectorDatabase } from '../../../database/vector_adapters';
import { restrictSettingsFile } from '../../../shared/restrict_settings_file';
import {
	DEFAULT_RAG_INDEX_NAME,
	LOCAL_RAG_DATABASE_ID,
	LOCAL_RAG_DATABASE_PROVIDER_ID,
	type RagConfiguration,
} from '../../../../shared/rag_types';
import { userDataLocation } from '../../../shared/user_data_location';
import { normalizeRagIndexName } from './rag_index_name';

const DEFAULT_RAG_CONFIGURATION: RagConfiguration = {
	enabled: false,
	indexName: DEFAULT_RAG_INDEX_NAME,
	databaseProviderId: LOCAL_RAG_DATABASE_PROVIDER_ID,
	databaseId: LOCAL_RAG_DATABASE_ID,
	embeddingProviderId: '',
	embeddingModelId: '',
	embeddingConsent: null,
	mirrorConsent: null,
	folders: [],
	scheduleEnabled: false,
	cronExpression: '0 3 * * *',
	timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	minimumScore: 0,
};

const configurationListeners = new Set<() => void>();
const settingsDirectory = path.resolve(userDataLocation(), 'rag');
export const ragConfigurationExisted = existsSync(path.join(settingsDirectory, 'settings.json'));

const store = new Store<RagConfiguration>({
	name: 'settings',
	cwd: settingsDirectory,
	accessPropertiesByDotNotation: false,
	configFileMode: 0o600,
	defaults: DEFAULT_RAG_CONFIGURATION,
});

export const ragConfigurationStorePath = store.path;
restrictSettingsFile(store.path);

export function getRagConfiguration(): RagConfiguration {
	const configuration = {
		...DEFAULT_RAG_CONFIGURATION,
		...store.store,
		folders: [...store.get('folders')],
	};
	return sanitizeRagConsent(configuration);
}

export function saveRagConfiguration(configuration: RagConfiguration): RagConfiguration {
	if (
		!configuration ||
		typeof configuration !== 'object' ||
		Array.isArray(configuration) ||
		!['indexName', 'databaseProviderId', 'databaseId', 'embeddingProviderId', 'embeddingModelId', 'cronExpression']
			.every((key) => typeof configuration[key as keyof RagConfiguration] === 'string') ||
		typeof configuration.enabled !== 'boolean' ||
		typeof configuration.scheduleEnabled !== 'boolean' ||
		!Array.isArray(configuration.folders) ||
		configuration.folders.some((folder) => typeof folder !== 'string') ||
		(configuration.timezone !== undefined && typeof configuration.timezone !== 'string') ||
		(configuration.embeddingConsent != null &&
			(typeof configuration.embeddingConsent !== 'object' ||
				typeof configuration.embeddingConsent.providerId !== 'string' ||
				typeof configuration.embeddingConsent.modelId !== 'string' ||
				(configuration.embeddingConsent.recipient !== undefined &&
					typeof configuration.embeddingConsent.recipient !== 'string'))) ||
		(configuration.mirrorConsent != null &&
			(typeof configuration.mirrorConsent !== 'object' ||
				configuration.mirrorConsent.version !== 1 ||
				typeof configuration.mirrorConsent.indexName !== 'string' ||
				(configuration.mirrorConsent.recipient !== undefined &&
					typeof configuration.mirrorConsent.recipient !== 'string')))
	) throw new Error('Invalid Knowledge configuration.');
	const indexName = normalizeRagIndexName(configuration.indexName);
	const folders = [
		...new Set(configuration.folders.map((folder) => folder.trim()).filter(Boolean)),
	];
	const cronExpression = configuration.cronExpression.trim().replace(/\s+/g, ' ');
	if (configuration.scheduleEnabled && !cron.validate(cronExpression)) {
		throw new Error('RAG indexing schedule must be a valid cron expression.');
	}
	const timezone = configuration.timezone?.trim() || DEFAULT_RAG_CONFIGURATION.timezone!;
	try {
		new Intl.DateTimeFormat('en', { timeZone: timezone });
	} catch {
		throw new Error('Knowledge indexing timezone must be a valid IANA timezone.');
	}
	const databaseProviderId = configuration.databaseProviderId?.trim() ?? '';
	const databaseId = configuration.databaseId?.trim() ?? '';
	const localDatabase =
		databaseProviderId === LOCAL_RAG_DATABASE_PROVIDER_ID && databaseId === LOCAL_RAG_DATABASE_ID;
	if (
		Boolean(databaseProviderId) !== Boolean(databaseId) ||
		(databaseId && !localDatabase && !supportsVectorDatabase(databaseProviderId, databaseId))
	)
		throw new Error('Select a supported Knowledge database.');
	const minimumScore = configuration.minimumScore ?? 0;
	if (!Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 1)
		throw new Error('Knowledge minimum similarity must be between 0 and 1.');
	const saved = sanitizeRagConsent({
		enabled: configuration.enabled === true,
		indexName,
		databaseProviderId,
		databaseId,
		embeddingProviderId: configuration.embeddingProviderId?.trim() ?? '',
		embeddingModelId: configuration.embeddingModelId?.trim() ?? '',
		embeddingConsent:
			configuration.embeddingConsent?.providerId.trim() ===
				configuration.embeddingProviderId?.trim() &&
			configuration.embeddingConsent.modelId.trim() === configuration.embeddingModelId?.trim() &&
			configuration.embeddingConsent.providerId.trim() &&
			configuration.embeddingConsent.modelId.trim()
				? {
						providerId: configuration.embeddingConsent.providerId.trim(),
						modelId: configuration.embeddingConsent.modelId.trim(),
						...(configuration.embeddingConsent.version === 1
							? { version: 1 as const, recipient: configuration.embeddingConsent.recipient }
							: {}),
					}
				: null,
		mirrorConsent:
			!localDatabase &&
			databaseId &&
			configuration.mirrorConsent?.version === 1 &&
			configuration.mirrorConsent.indexName === indexName
				? {
						...configuration.mirrorConsent,
						indexName: normalizeRagIndexName(configuration.mirrorConsent.indexName),
					}
				: null,
		folders,
		scheduleEnabled: configuration.scheduleEnabled === true,
		cronExpression: cronExpression || DEFAULT_RAG_CONFIGURATION.cronExpression,
		timezone,
		minimumScore,
	});
	store.store = saved;
	restrictSettingsFile(store.path);
	for (const listener of configurationListeners) listener();
	return saved;
}

export function subscribeRagConfiguration(listener: () => void): () => void {
	configurationListeners.add(listener);
	return () => configurationListeners.delete(listener);
}
