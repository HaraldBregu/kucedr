import { generateEmbeddings } from '../../../../src/main/models/adapters/embedding';

beforeEach(() => {
	global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }] })));
});

it.each(['query', 'document'] as const)('formats Embedding 2 %s inputs as separate content requests', async (inputType) => {
	await expect(generateEmbeddings({ providerId: 'google', apiKey: 'synthetic-key', modelId: 'gemini-embedding-2', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', texts: ['first', 'second'], inputType })).resolves.toEqual([[0.1, 0.2], [0.3, 0.4]]);
	const [url, init] = jest.mocked(global.fetch).mock.calls[0];
	expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents');
	expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'synthetic-key' });
	const body = JSON.parse(String(init?.body));
	expect(body.requests).toEqual(['first', 'second'].map((text) => ({ model: 'models/gemini-embedding-2', content: { parts: [{ text: inputType === 'query' ? `task: search result | query: ${text}` : `title: none | text: ${text}` }] } })));
});

it.each(['query', 'document'] as const)('uses the legacy taskType for Embedding 001 %s', async (inputType) => {
	await generateEmbeddings({ providerId: 'google', apiKey: 'synthetic-key', modelId: 'gemini-embedding-001', baseURL: 'https://generativelanguage.googleapis.com/v1beta', texts: ['first', 'second'], inputType });
	const body = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0][1]?.body));
	expect(body.requests[0]).toEqual({ model: 'models/gemini-embedding-001', content: { parts: [{ text: 'first' }] }, taskType: inputType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT' });
});
