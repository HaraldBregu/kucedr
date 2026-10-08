import path from 'node:path';
import Store from 'electron-store';
import cron from 'node-cron';
import { ragRecipient } from './recipient';
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

const store = new Store<RagConfiguration>({
	name: 'settings',
	cwd: path.resolve(userDataLocation(), 'rag'),
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
	for (const kind of ['embedding', 'mirror'] as const) {
		const key = kind === 'embedding' ? 'embeddingConsent' : 'mirrorConsent';
		const consent = configuration[key];
		try {
			if (
				consent?.version !== 1 ||
				consent.recipient !==
					ragRecipient(
						kind,
						configuration.embeddingProviderId,
						configuration.embeddingModelId,
						configuration.indexName,
						configuration
					)
			)
				configuration[key] = null;
		} catch {
			configuration[key] = null;
		}
	}
	return configuration;
}

export function saveRagConfiguration(configuration: RagConfiguration): RagConfiguration {
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
	const saved = {
		enabled: configuration.enabled === true,
		indexName,
		databaseProviderId,
		databaseId,
		embeddingProviderId: configuration.embeddingProviderId?.trim() ?? '',
		embeddingModelId: configuration.embeddingModelId?.trim() ?? '',
		embeddingConsent:
			configuration.embeddingConsent?.providerId.trim() === configuration.embeddingProviderId?.trim() &&
			configuration.embeddingConsent.modelId.trim() === configuration.embeddingModelId?.trim() &&
			configuration.embeddingConsent.providerId.trim() && configuration.embeddingConsent.modelId.trim()
				? {
						providerId: configuration.embeddingConsent.providerId.trim(),
						modelId: configuration.embeddingConsent.modelId.trim(),
						...(configuration.embeddingConsent.version === 1
							? { version: 1 as const, recipient: configuration.embeddingConsent.recipient }
							: {}),
					}
				: null,
		mirrorConsent:
			!localDatabase && databaseId && configuration.mirrorConsent?.version === 1 &&
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
	};
	store.store = saved;
	restrictSettingsFile(store.path);
	for (const listener of configurationListeners) listener();
	return saved;
}

export function subscribeRagConfiguration(listener: () => void): () => void {
	configurationListeners.add(listener);
	return () => configurationListeners.delete(listener);
}
