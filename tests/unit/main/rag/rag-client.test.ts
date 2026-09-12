const getProvider = jest.fn();
const getRagConfiguration = jest.fn();
const loadDatabases = jest.fn();
jest.mock('../../../../src/main/settings_store', () => ({ getProvider }));
jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({ getRagConfiguration }));
jest.mock('../../../../src/main/models', () => ({ loadDatabases }));

import { selectedVectorDatabaseConnection } from '../../../../src/main/database/vector_connection';

beforeEach(() => {
	jest.clearAllMocks();
	getRagConfiguration.mockReturnValue({ databaseProviderId: 'pinecone', databaseId: 'pinecone' });
	getProvider.mockReturnValue({ apiKey: ' user-database-key ' });
	loadDatabases.mockReturnValue([
		{
			id: 'pinecone',
			name: 'Pinecone Vector Database',
			provider: { id: 'pinecone', name: 'Pinecone' },
		},
	]);
});

it('uses only selected database credentials and never an environment fallback', () => {
	process.env.PINECONE_API_KEY = 'environment-key';
	const connection = selectedVectorDatabaseConnection({
		providerId: 'pinecone',
		databaseId: 'pinecone',
	});
	expect(getProvider).toHaveBeenCalledWith('pinecone', 'databases');
	expect(connection).toMatchObject({
		configuration: { providerId: 'pinecone', databaseId: 'pinecone' },
		apiKey: 'user-database-key',
	});
	delete process.env.PINECONE_API_KEY;
});

it('requires an explicit supported database selection and saved credential', () => {
	getRagConfiguration.mockReturnValue({ databaseProviderId: '', databaseId: '' });
	expect(() => selectedVectorDatabaseConnection({ providerId: undefined, databaseId: undefined })).toThrow(
		'Select a vector database'
	);
	getRagConfiguration.mockReturnValue({ databaseProviderId: 'other', databaseId: 'other' });
	expect(() => selectedVectorDatabaseConnection({ providerId: 'other', databaseId: 'other' })).toThrow(
		'not supported'
	);
	getRagConfiguration.mockReturnValue({ databaseProviderId: 'pinecone', databaseId: 'pinecone' });
	getProvider.mockReturnValue(undefined);
	expect(() =>
		selectedVectorDatabaseConnection({ providerId: 'pinecone', databaseId: 'pinecone' })
	).toThrow('Settings → Providers → Database');
});
