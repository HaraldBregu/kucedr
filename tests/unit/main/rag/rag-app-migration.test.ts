const mockOperations: string[] = [];
let mockAppStore: Record<string, unknown> = {};
let mockSavedRag: Record<string, unknown> | undefined;
const mockStoreNames: string[] = [];

jest.mock('electron-store', () =>
	jest.fn().mockImplementation(({ name, defaults }) => {
		mockStoreNames.push(name);
		let backing: Record<string, unknown> =
			name === 'app'
				? {
						...defaults,
						databaseConfiguration: {
							providerId: 'pinecone',
							databaseId: 'pinecone',
						},
						modelSelections: {
							...(defaults.modelSelections as Record<string, unknown>),
							text: {
								providerId: 'openai',
								modelId: 'gpt-5',
							},
							embedding: {
								providerId: 'openai',
								modelId: 'text-embedding-3-small',
							},
						},
					}
				: { ...defaults };
		if (name === 'app') mockAppStore = backing;
		return {
			path: `/settings/${name}.json`,
			get(key: string) {
				return backing[key];
			},
			set(key: string, value: unknown) {
				backing = { ...backing, [key]: value };
			},
			get store() {
				return backing;
			},
			set store(value: Record<string, unknown>) {
				backing = value;
				if (name === 'app') {
					mockAppStore = backing;
					mockOperations.push('app');
				}
			},
		};
	})
);
jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({
	getRagConfiguration: () => ({
		indexName: 'kucedr',
		databaseProviderId: '',
		databaseId: '',
		embeddingProviderId: '',
		embeddingModelId: '',
		folders: [],
		scheduleEnabled: false,
		cronExpression: '0 3 * * *',
	}),
	saveRagConfiguration: (configuration: Record<string, unknown>) => {
		mockSavedRag = configuration;
		mockOperations.push('rag');
		return configuration;
	},
}));

import '../../../../src/main/settings_store';

it('moves legacy database and embedding selections before cleaning app settings', () => {
	expect(mockSavedRag).toEqual(
		expect.objectContaining({
			databaseProviderId: 'pinecone',
			databaseId: 'pinecone',
			embeddingProviderId: 'openai',
			embeddingModelId: 'text-embedding-3-small',
		})
	);
	expect(mockOperations).toEqual(['rag', 'app']);
	expect(mockAppStore).not.toHaveProperty('databaseConfiguration');
	expect(mockAppStore).not.toHaveProperty('modelSelections');
	expect(mockStoreNames).not.toContain('models');
});
