import { generateEmbeddings } from '../../../../src/main/models/adapters/embedding';
import type { CatalogModel } from '../../../../src/shared/model_types';

const model = (protocol: string, inputs: Record<string, unknown> = {}) =>
	({
		id: 'test-model',
		name: 'Test Model',
		provider: { name: 'Test' },
		metadata: { documentationUrl: '', protocol, inputs },
	}) as unknown as CatalogModel;

const options = {
	model: model('embeddings'),
	apiKey: 'synthetic-key',
	baseURL: 'https://api.example.test/embeddings',
	texts: ['first', 'second'],
};

beforeEach(() => {
	global.fetch = jest.fn();
});

it.each(['embeddings', 'embeddings-input-type', 'embeddings-task'])(
	'uses response indexes to keep %s embeddings aligned with input order',
	async (protocol) => {
		jest.mocked(global.fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					data: [
						{ index: 1, embedding: [0.3, 0.4] },
						{ index: 0, embedding: [0.1, 0.2] },
					],
				})
			)
		);
		await expect(generateEmbeddings({ ...options, model: model(protocol) })).resolves.toEqual([
			[0.1, 0.2],
			[0.3, 0.4],
		]);
	}
);

it.each(
	[
		[0, 0],
		[0, 2],
		[0, -1],
		[0, 0.5],
		[0, undefined],
	].map((indexes) => ({ indexes }))
)(
	'rejects duplicated, out of bounds, and missing response indexes: $indexes',
	async ({ indexes }) => {
		jest
			.mocked(global.fetch)
			.mockResolvedValue(
				new Response(JSON.stringify({ data: indexes.map((index) => ({ index, embedding: [1] })) }))
			);
		await expect(generateEmbeddings(options)).rejects.toThrow('malformed embedding indexes');
	}
);

it.each([
	[
		'embed-types',
		'document',
		{ input_type: 'search_document', truncate: 'NONE', embedding_types: ['float'] },
	],
	['embed-types', 'query', { input_type: 'search_query', truncate: 'NONE' }],
	[
		'embeddings-input-type',
		'document',
		{ input_type: 'document', truncation: false, output_dtype: 'float' },
	],
	['embeddings-input-type', 'query', { input_type: 'query', truncation: false }],
	[
		'embeddings-task',
		'document',
		{ task: 'retrieval.passage', truncate: false, embedding_type: 'float' },
	],
	['embeddings-task', 'query', { task: 'retrieval.query', truncate: false }],
	['embed-text', 'document', { task_type: 'search_document', long_text_mode: 'mean' }],
	['embed-text', 'query', { task_type: 'search_query', long_text_mode: 'mean' }],
	['embeddings', 'document', { encoding_format: 'float' }],
] as const)(
	'maps %s %s retrieval inputs without discarding long content',
	async (protocol, inputType, expected) => {
		jest.mocked(global.fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					data: [{ index: 0, embedding: [0.1, 0.2] }],
					embeddings: protocol === 'embed-types' ? { float: [[0.1, 0.2]] } : [[0.1, 0.2]],
				})
			)
		);
		await generateEmbeddings({ ...options, model: model(protocol), inputType, texts: ['document'] });
		const init = jest.mocked(global.fetch).mock.calls[0]?.[1];
		expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'test-model', ...expected });
	}
);

it('bounds API batches and preserves order across batches', async () => {
	jest.mocked(global.fetch).mockImplementation(async (_url, init) => {
		const body = JSON.parse(String(init?.body));
		return new Response(
			JSON.stringify({
				data: body.input.map((text: string, index: number) => ({
					index,
					embedding: [Number(text) + 1],
				})),
			})
		);
	});
	const result = await generateEmbeddings({
		...options,
		texts: Array.from({ length: 130 }, (_, index) => String(index)),
	});
	expect(
		jest
			.mocked(global.fetch)
			.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).input.length)
	).toEqual([64, 64, 2]);
	expect(result.map(([value]) => value)).toEqual(
		Array.from({ length: 130 }, (_, index) => index + 1)
	);
});

it('stops after cancellation between batches', async () => {
	const controller = new AbortController();
	jest.mocked(global.fetch).mockImplementation(async (_url, init) => {
		const body = JSON.parse(String(init?.body));
		controller.abort(new Error('Canceled'));
		return new Response(
			JSON.stringify({
				data: body.input.map((_: string, index: number) => ({ index, embedding: [1] })),
			})
		);
	});
	await expect(
		generateEmbeddings({ ...options, texts: new Array(65).fill('text'), signal: controller.signal })
	).rejects.toThrow('Canceled');
	expect(global.fetch).toHaveBeenCalledTimes(1);
});

it.each([
	[20, [20, 20, 5]],
	[10, [10, 10, 10, 10, 5]],
])('honors the model batch limit of %s and keeps input order', async (maxItems, sizes) => {
	jest.mocked(global.fetch).mockImplementation(async (_url, init) => {
		const body = JSON.parse(String(init?.body));
		return new Response(
			JSON.stringify({
				model: 'test-model',
				data: body.input.map((text: string, index: number) => ({
					index,
					embedding: [Number(text) + 1],
				})),
			})
		);
	});
	const embeddings = await generateEmbeddings({
		...options,
		model: model('embeddings', { input: { type: 'array', maxItems } }),
		texts: Array.from({ length: 45 }, (_, index) => String(index)),
	});
	expect(
		jest
			.mocked(global.fetch)
			.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).input.length)
	).toEqual(sizes);
	expect(embeddings.map(([value]) => value)).toEqual(
		Array.from({ length: 45 }, (_, index) => index + 1)
	);
});

it('rejects dimensions that change between API batches', async () => {
	jest.mocked(global.fetch).mockImplementation(async (_url, init) => {
		const body = JSON.parse(String(init?.body));
		return new Response(
			JSON.stringify({
				data: body.input.map((_: string, index: number) => ({
					index,
					embedding: body.input.length === 64 ? [1, 2] : [1],
				})),
			})
		);
	});
	await expect(
		generateEmbeddings({ ...options, texts: new Array(65).fill('text') })
	).rejects.toThrow('dimensions changed between batches');
});

it('rejects invalid vector data before returning results', async () => {
	jest
		.mocked(global.fetch)
		.mockResolvedValue(new Response(JSON.stringify({ data: [{ index: 0, embedding: [0, 0] }] })));
	await expect(generateEmbeddings({ ...options, texts: ['document'] })).rejects.toThrow(
		'malformed embeddings'
	);
});

it('rejects a response produced by a different embedding model', async () => {
	jest
		.mocked(global.fetch)
		.mockResolvedValue(
			new Response(
				JSON.stringify({ model: 'different-model', data: [{ index: 0, embedding: [1, 2] }] })
			)
		);
	await expect(generateEmbeddings({ ...options, texts: ['document'] })).rejects.toThrow(
		'did not use the selected embedding model'
	);
});

it('accepts the provider response when its returned model matches the selection', async () => {
	jest
		.mocked(global.fetch)
		.mockResolvedValue(
			new Response(JSON.stringify({ model: 'test-model', data: [{ index: 0, embedding: [1, 2] }] }))
		);
	await expect(generateEmbeddings({ ...options, texts: ['document'] })).resolves.toEqual([[1, 2]]);
});
