const vectorScriptKey = jest.fn();
jest.mock('../../../../src/main/database/vector_keys', () => ({ vectorScriptKey }));
jest.mock('../../../../src/main/plugins', () => ({
	pluginScripts: () => [
		{ name: 'vector-db', title: 'Vector DB', plugin: { id: 'bootstrap', name: 'Bootstrap' } },
	],
}));

import { selectedVectorDatabaseConnection } from '../../../../src/main/database/vector_connection';

beforeEach(() => {
	jest.clearAllMocks();
	vectorScriptKey.mockReturnValue(' user-database-key ');
});

it('uses only the selected script credential and never an environment fallback', () => {
	process.env.PINECONE_API_KEY = 'environment-key';
	const connection = selectedVectorDatabaseConnection({
		providerId: 'script',
		databaseId: 'vector-db',
	});
	expect(vectorScriptKey).toHaveBeenCalledWith('vector-db');
	expect(connection).toMatchObject({
		configuration: { providerId: 'script', databaseId: 'vector-db' },
		apiKey: 'user-database-key',
	});
	delete process.env.PINECONE_API_KEY;
});

it('requires an explicit supported database selection and saved credential', () => {
	expect(() => selectedVectorDatabaseConnection({ providerId: undefined, databaseId: undefined })).toThrow(
		'Select a vector database'
	);
	expect(() => selectedVectorDatabaseConnection({ providerId: 'other', databaseId: 'other' })).toThrow(
		'not supported'
	);
	pluginSettings.mockReturnValue({});
	expect(() =>
		selectedVectorDatabaseConnection({ providerId: 'script', databaseId: 'vector-db' })
	).toThrow('Settings → Scripts → Vector DB');
});
