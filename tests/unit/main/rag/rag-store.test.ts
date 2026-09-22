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
} from '../../../../src/main/agent/knowledge/rag/rag_store';

it('defaults, normalizes, and validates the configured RAG index name', () => {
	validate.mockReturnValue(true);
	expect(ragConfigurationStorePath).toBe(path.join(root, 'rag', 'settings.json'));
	expect(getRagConfiguration()).toEqual(
		expect.objectContaining({
			enabled: false,
			indexName: 'kucedr',
			databaseProviderId: '',
			databaseId: '',
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
