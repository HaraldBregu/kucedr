import { generateEmbeddings } from '../../../../src/main/models/adapters/embedding';
import type { CatalogModel } from '../../../../src/shared/model_types';

const model = (id: string, inputTemplates?: Record<string, string>) =>
	({
		id,
		name: 'Test Model',
		provider: { name: 'Test' },
		metadata: {
			documentationUrl: '',
			protocol: 'batch-embed-contents',
			inputs: {},
			inputTemplates,
		},
	}) as unknown as CatalogModel;

beforeEach(() => {
	global.fetch = jest
		.fn()
		.mockResolvedValue(
			new Response(JSON.stringify({ embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }] }))
		);
});

it.each(['query', 'document'] as const)(
	'formats templated %s inputs as separate content requests',
	async (inputType) => {
		await expect(
			generateEmbeddings({
				model: model('embedding-2', {
					query: 'task: search result | query: {text}',
					document: 'title: none | text: {text}',
				}),
				apiKey: 'synthetic-key',
				baseURL: 'https://api.example.test/v1beta',
				texts: ['first', 'second'],
				inputType,
			})
		).resolves.toEqual([
			[0.1, 0.2],
			[0.3, 0.4],
		]);
		const [url, init] = jest.mocked(global.fetch).mock.calls[0];
		expect(url).toBe('https://api.example.test/v1beta/models/embedding-2:batchEmbedContents');
		expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'synthetic-key' });
		const body = JSON.parse(String(init?.body));
		expect(body.requests).toEqual(
			['first', 'second'].map((text) => ({
				model: 'models/embedding-2',
				content: {
					parts: [
						{
							text:
								inputType === 'query'
									? `task: search result | query: ${text}`
									: `title: none | text: ${text}`,
						},
					],
				},
			}))
		);
	}
);

it.each(['query', 'document'] as const)(
	'uses the taskType for untemplated %s inputs',
	async (inputType) => {
		await generateEmbeddings({
			model: model('embedding-001'),
			apiKey: 'synthetic-key',
			baseURL: 'https://api.example.test/v1beta',
			texts: ['first', 'second'],
			inputType,
		});
		const body = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0][1]?.body));
		expect(body.requests[0]).toEqual({
			model: 'models/embedding-001',
			content: { parts: [{ text: 'first' }] },
			taskType: inputType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
		});
	}
);
