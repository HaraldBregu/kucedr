import path from 'node:path';

const validate = jest.fn();
const root = '/tmp/kucedr-rag-store-test';

jest.mock('node-cron', () => ({
	__esModule: true,
	default: { validate },
}));
jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => root,
}));
jest.mock('../../../../src/main/shared/restrict_settings_file', () => ({
	restrictSettingsFile: jest.fn(),
}));

import {
	getRagConfiguration,
	ragConfigurationStorePath,
	saveRagConfiguration,
	subscribeRagConfiguration,
} from '../../../../src/main/agent/knowledge/rag/rag_store';

it('defaults, normalizes, and validates the configured RAG index name', () => {
	validate.mockReturnValue(true);
	expect(ragConfigurationStorePath).toBe(path.join(root, 'rag', 'settings.json'));
	expect(getRagConfiguration()).toEqual(
		expect.objectContaining({
			enabled: false,
			indexName: 'kucedr',
			databaseProviderId: 'local',
			databaseId: 'sqlite',
			embeddingProviderId: '',
			embeddingModelId: '',
			embeddingConsent: null,
		})
	);

	expect(
		saveRagConfiguration({
			enabled: true,
			indexName: ' knowledge-base ',
			databaseProviderId: ' pinecone ',
			databaseId: ' pinecone ',
			embeddingProviderId: ' openai ',
			embeddingModelId: ' text-embedding-3-small ',
			embeddingConsent: { providerId: ' openai ', modelId: ' text-embedding-3-small ' },
			folders: ['/documents'],
			scheduleEnabled: false,
			cronExpression: '0 3 * * *',
		})
	).toEqual(
		expect.objectContaining({
			enabled: true,
			indexName: 'knowledge-base',
			databaseProviderId: 'pinecone',
			databaseId: 'pinecone',
			embeddingProviderId: 'openai',
			embeddingModelId: 'text-embedding-3-small',
			embeddingConsent: { providerId: 'openai', modelId: 'text-embedding-3-small' },
		})
	);

	expect(() =>
		saveRagConfiguration({
			enabled: false,
			indexName: 'Invalid_Name',
			databaseProviderId: '',
			databaseId: '',
			embeddingProviderId: '',
			embeddingModelId: '',
			embeddingConsent: null,
			folders: [],
			scheduleEnabled: false,
			cronExpression: '0 3 * * *',
		})
	).toThrow('RAG index name must be 1-45 lowercase letters, numbers, or hyphens');
});

it('validates explicit local storage, atomic database selection, timezone, cron, and similarity settings', () => {
	validate.mockReturnValue(true);
	const configuration = {
		...getRagConfiguration(),
		databaseProviderId: 'local',
		databaseId: 'sqlite',
		mirrorConsent: { version: 1 as const, indexName: 'knowledge-base', recipient: 'old-remote' },
		timezone: ' Europe/Rome ',
		minimumScore: 0.2,
	};
	expect(saveRagConfiguration(configuration)).toMatchObject({
		databaseProviderId: 'local', databaseId: 'sqlite', mirrorConsent: null,
		timezone: 'Europe/Rome', minimumScore: 0.2,
	});
	for (const database of [
		{ databaseProviderId: 'local', databaseId: '' },
		{ databaseProviderId: 'unsupported', databaseId: 'postgres' },
	]) expect(() => saveRagConfiguration({ ...configuration, ...database })).toThrow('supported Knowledge database');
	expect(() => saveRagConfiguration({ ...configuration, timezone: 'Not/AZone' })).toThrow('IANA timezone');
	for (const minimumScore of [-0.1, 1.1, NaN])
		expect(() => saveRagConfiguration({ ...configuration, minimumScore })).toThrow('between 0 and 1');
	validate.mockReturnValue(false);
	expect(() => saveRagConfiguration({ ...configuration, scheduleEnabled: true })).toThrow('valid cron expression');
});

it('clears embedding consent copied from a different model and notifies subscribers on saves', () => {
	validate.mockReturnValue(true);
	const changed = jest.fn();
	const unsubscribe = subscribeRagConfiguration(changed);
	const configuration = {
		...getRagConfiguration(),
		embeddingProviderId: 'openai',
		embeddingModelId: 'text-embedding-3-large',
		embeddingConsent: { version: 1 as const, providerId: 'openai', modelId: 'text-embedding-3-small', recipient: 'old-model' },
	};
	expect(saveRagConfiguration(configuration).embeddingConsent).toBeNull();
	expect(changed).toHaveBeenCalledTimes(1);
	unsubscribe();
	saveRagConfiguration(configuration);
	expect(changed).toHaveBeenCalledTimes(1);
});
