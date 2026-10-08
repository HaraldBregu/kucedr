import path from 'node:path';

const validate = jest.fn();
const ragRecipient = jest.fn();
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
jest.mock('../../../../src/main/agent/knowledge/rag/recipient', () => ({ ragRecipient }));

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
			embeddingConsent: null,
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
		databaseProviderId: 'local',
		databaseId: 'sqlite',
		mirrorConsent: null,
		timezone: 'Europe/Rome',
		minimumScore: 0.2,
	});
	for (const database of [
		{ databaseProviderId: 'local', databaseId: '' },
		{ databaseProviderId: 'unsupported', databaseId: 'postgres' },
	])
		expect(() => saveRagConfiguration({ ...configuration, ...database })).toThrow(
			'supported Knowledge database'
		);
	expect(() => saveRagConfiguration({ ...configuration, timezone: 'Not/AZone' })).toThrow(
		'IANA timezone'
	);
	for (const minimumScore of [-0.1, 1.1, NaN])
		expect(() => saveRagConfiguration({ ...configuration, minimumScore })).toThrow(
			'between 0 and 1'
		);
	validate.mockReturnValue(false);
	expect(() => saveRagConfiguration({ ...configuration, scheduleEnabled: true })).toThrow(
		'valid cron expression'
	);
});

it('clears embedding consent copied from a different model and notifies subscribers on saves', () => {
	validate.mockReturnValue(true);
	const changed = jest.fn();
	const unsubscribe = subscribeRagConfiguration(changed);
	const configuration = {
		...getRagConfiguration(),
		embeddingProviderId: 'openai',
		embeddingModelId: 'text-embedding-3-large',
		embeddingConsent: {
			version: 1 as const,
			providerId: 'openai',
			modelId: 'text-embedding-3-small',
			recipient: 'old-model',
		},
	};
	expect(saveRagConfiguration(configuration).embeddingConsent).toBeNull();
	expect(changed).toHaveBeenCalledTimes(1);
	unsubscribe();
	saveRagConfiguration(configuration);
	expect(changed).toHaveBeenCalledTimes(1);
});

it('revokes copied remote consent during the save after its database, index, or account changes', () => {
	validate.mockReturnValue(true);
	ragRecipient.mockImplementation((kind) =>
		kind === 'embedding' ? 'embedding-account' : 'mirror-account'
	);
	const configuration = {
		...getRagConfiguration(),
		indexName: 'knowledge-base',
		databaseProviderId: 'pinecone',
		databaseId: 'pinecone',
		embeddingProviderId: 'openai',
		embeddingModelId: 'text-embedding-3-small',
		embeddingConsent: {
			version: 1 as const,
			providerId: 'openai',
			modelId: 'text-embedding-3-small',
			recipient: 'embedding-account',
		},
		mirrorConsent: {
			version: 1 as const,
			indexName: 'knowledge-base',
			recipient: 'mirror-account',
		},
	};
	expect(saveRagConfiguration(configuration)).toMatchObject({
		embeddingConsent: configuration.embeddingConsent,
		mirrorConsent: configuration.mirrorConsent,
	});
	expect(
		saveRagConfiguration({ ...configuration, databaseProviderId: 'local', databaseId: 'sqlite' })
			.mirrorConsent
	).toBeNull();
	expect(
		saveRagConfiguration({ ...configuration, indexName: 'different-index' }).mirrorConsent
	).toBeNull();
	ragRecipient.mockReturnValue('changed-account');
	expect(saveRagConfiguration(configuration)).toMatchObject({
		embeddingConsent: null,
		mirrorConsent: null,
	});
});

it.each([null, {}, { folders: 'invalid' }, { embeddingConsent: {} }])(
	'rejects malformed runtime configurations before persistence',
	(configuration) => {
		expect(() => saveRagConfiguration(configuration as never)).toThrow(
			'Invalid Knowledge configuration'
		);
	}
);
