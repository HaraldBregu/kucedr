const mockPinecone = jest.fn(() => ({ index: jest.fn() }));
const getProvider = jest.fn();
const getRagConfiguration = jest.fn();

jest.mock('@pinecone-database/pinecone', () => ({ Pinecone: mockPinecone }));
jest.mock('../../../../src/main/settings_store', () => ({ getProvider }));
jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({ getRagConfiguration }));

import { ragClient } from '../../../../src/main/agent/knowledge/rag/rag_client';

beforeEach(() => {
	jest.clearAllMocks();
	getRagConfiguration.mockReturnValue({ databaseProviderId: 'pinecone', databaseId: 'pinecone' });
	getProvider.mockReturnValue({ apiKey: ' user-database-key ' });
});

afterEach(() => {
	delete process.env.PINECONE_API_KEY;
	mockPinecone.mockClear();
});

it('uses the selected database provider credentials instead of an environment key', () => {
	process.env.PINECONE_API_KEY = ' environment-key ';

	const client = ragClient();

	expect(getProvider).toHaveBeenCalledWith('pinecone', 'databases');
	expect(mockPinecone).toHaveBeenCalledWith({ apiKey: 'user-database-key' });
	expect(client).toEqual(expect.objectContaining({ index: expect.any(Function) }));
});

it('requires an explicit database selection even with an environment key', () => {
	process.env.PINECONE_API_KEY = 'environment-key';
	getRagConfiguration.mockReturnValue({ databaseProviderId: '', databaseId: '' });
	expect(() => ragClient()).toThrow('Select a vector database in RAG settings');
	expect(mockPinecone).not.toHaveBeenCalled();
});

it('requires the selected database account key even with an environment key', () => {
	process.env.PINECONE_API_KEY = 'environment-key';
	getProvider.mockReturnValue(undefined);
	expect(() => ragClient()).toThrow('Settings → Providers → Vector DB');
	expect(mockPinecone).not.toHaveBeenCalled();
});

it('rejects unsupported selections without falling back to Pinecone', () => {
	getRagConfiguration.mockReturnValue({ databaseProviderId: 'other', databaseId: 'other' });
	expect(() => ragClient()).toThrow('not supported');
	expect(mockPinecone).not.toHaveBeenCalled();
});

it('uses a pinned account for failed-upload cleanup after the selection is removed', () => {
	getRagConfiguration.mockReturnValue({ databaseProviderId: '', databaseId: '' });
	ragClient(undefined, 'original-account-key');
	expect(mockPinecone).toHaveBeenCalledWith({ apiKey: 'original-account-key' });
	expect(getProvider).not.toHaveBeenCalled();
});
