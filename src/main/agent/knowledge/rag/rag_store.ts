import path from 'node:path';
import Store from 'electron-store';
import cron from 'node-cron';
import { ragRecipient } from './recipient';
import { restrictSettingsFile } from '../../../shared/restrict_settings_file';
import { DEFAULT_RAG_INDEX_NAME, type RagConfiguration } from '../../../../shared/rag_types';
import { userDataLocation } from '../../../shared/user_data_location';
import { normalizeRagIndexName } from './rag_index_name';

const DEFAULT_RAG_CONFIGURATION: RagConfiguration = {
	enabled: false,
	indexName: DEFAULT_RAG_INDEX_NAME,
	databaseProviderId: '',
	databaseId: '',
	embeddingProviderId: '',
	embeddingModelId: '',
	embeddingConsent: null,
	mirrorConsent: null,
	folders: [],
	scheduleEnabled: false,
	cronExpression: '0 3 * * *',
};

const store = new Store<RagConfiguration>({
	name: 'rag',
	cwd: path.resolve(userDataLocation(), 'settings'),
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
	const saved = {
		enabled: configuration.enabled === true,
		indexName,
		databaseProviderId: configuration.databaseProviderId?.trim() ?? '',
		databaseId: configuration.databaseId?.trim() ?? '',
		embeddingProviderId: configuration.embeddingProviderId?.trim() ?? '',
		embeddingModelId: configuration.embeddingModelId?.trim() ?? '',
		embeddingConsent:
			configuration.embeddingConsent?.providerId.trim() &&
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
			configuration.mirrorConsent?.version === 1
				? {
						...configuration.mirrorConsent,
						indexName: normalizeRagIndexName(configuration.mirrorConsent.indexName),
					}
				: null,
		folders,
		scheduleEnabled: configuration.scheduleEnabled,
		cronExpression: cronExpression || DEFAULT_RAG_CONFIGURATION.cronExpression,
	};
	store.store = saved;
	restrictSettingsFile(store.path);
	return saved;
}
