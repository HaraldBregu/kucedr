import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { loadModels, loadProviders } from '../../../../src/main/models';
import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => {
		const directory = path.resolve('resources/plugins/inception');
		const plugin = readPlugin(directory, 'inception', true);
		return [
			{ directory, manifest: plugin.provider, plugin: { id: 'inception', name: 'Inception' } },
		];
	},
}));

it('loads the documented Inception chat models and their API contracts', () => {
	const plugin = readPlugin(path.resolve('resources/plugins/inception'), 'inception', true);
	expect(plugin.provider).toBeDefined();
	expect(loadProviders()).toContainEqual(expect.objectContaining({ id: 'inception' }));
	const models = loadModels().filter((model) => model.provider.id === 'inception');
	expect(models.map((model) => model.id).sort()).toEqual([
		'mercury-2',
		'mercury-2.5',
		'mercury-3',
		'mercury-voice',
	]);
	for (const model of models) {
		expect(model).toMatchObject({
			type: 'llm',
			url: 'https://api.inceptionlabs.ai/v1',
			metadata: { protocol: 'chat-completions' },
		});
	}
});

it.each([
	[true, 'instant'],
	[false, 'high'],
] as const)(
	'routes Inception text generation through the OpenAI SDK with streaming=%s and effort=%s',
	async (streaming, effort) => {
		const create = jest.fn().mockImplementation(async () =>
			streaming
				? (async function* () {
						yield { choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] };
					})()
				: { choices: [{ message: { content: 'answer' }, finish_reason: 'stop' }], usage: {} }
		);
		const factory = jest.fn(() => ({ chat: { completions: { create } } }) as never);
		const model = new LlmModel({ chatClientFactory: factory });
		const events = [];
		for await (const event of model.stream({
			provider: { id: 'inception', apiKey: 'key' },
			model: 'mercury-3',
			effort,
			messages: [{ role: 'user', content: 'hello' }],
			options: { temperature: 0.7 },
			maxTokens: 123,
			streaming,
		}))
			events.push(event);
		expect(factory).toHaveBeenCalledWith({
			apiKey: 'key',
			baseURL: 'https://api.inceptionlabs.ai/v1',
		});
		expect(create.mock.calls[0][0]).toEqual(
			expect.objectContaining({
				model: 'mercury-3',
				messages: [{ role: 'user', content: 'hello' }],
				temperature: 0.7,
				max_completion_tokens: 123,
				reasoning_effort: effort,
				stream: streaming,
			})
		);
		expect(events).toContainEqual({ type: 'model_call_delta', delta: 'answer' });
	}
);
