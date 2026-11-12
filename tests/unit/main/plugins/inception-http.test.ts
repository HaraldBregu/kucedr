import path from 'node:path';
import OpenAI from 'openai';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => {
		const directory = path.resolve('resources/plugins/inception');
		const plugin = readPlugin(directory, 'inception', true);
		return [{ directory, manifest: plugin.provider, plugin: { id: 'inception', name: 'Inception' } }];
	},
}));

it('sends the documented streaming chat request through the OpenAI SDK', async () => {
	const chunks = [
		{ id: 'chat-1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }] },
		{ id: 'chat-1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: ' world' }, finish_reason: 'stop' }] },
		{ id: 'chat-1', object: 'chat.completion.chunk', choices: [], usage: { prompt_tokens: 10, completion_tokens: 2, cached_input_tokens: 4 } },
	];
	const body = `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`;
	const fetcher = jest.fn().mockResolvedValue(new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
	const model = new LlmModel({
		chatClientFactory: ({ apiKey, baseURL }) => new OpenAI({ apiKey, baseURL, fetch: fetcher }),
	});
	const events = [];
	for await (const event of model.stream({
		provider: { id: 'inception', apiKey: 'test-key' },
		model: 'mercury-3',
		effort: 'instant',
		messages: [{ role: 'user', content: 'hello' }],
		options: { temperature: 0.7, response_format: { type: 'json_object' } },
		tools: [{ id: 'lookup', name: 'lookup', description: 'Look up a value', schema: { type: 'object', properties: { id: { type: 'string' } } } } as never],
		maxTokens: 123,
		streaming: true,
	})) events.push(event);

	expect(fetcher).toHaveBeenCalledTimes(1);
	const [url, init] = fetcher.mock.calls[0];
	expect(String(url)).toBe('https://api.inceptionlabs.ai/v1/chat/completions');
	expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key');
	expect(JSON.parse(String(init.body))).toMatchObject({
		model: 'mercury-3',
		messages: [{ role: 'user', content: 'hello' }],
		reasoning_effort: 'instant',
		temperature: 0.7,
		response_format: { type: 'json_object' },
		max_completion_tokens: 123,
		stream: true,
		stream_options: { include_usage: true },
		tool_choice: 'auto',
		tools: [{ type: 'function', function: { name: 'lookup', description: 'Look up a value', parameters: { type: 'object', properties: { id: { type: 'string' } } } } }],
	});
	expect(JSON.parse(String(init.body))).not.toHaveProperty('max_tokens');
	expect(events).toEqual(expect.arrayContaining([
		{ type: 'model_call_delta', delta: 'Hello' },
		{ type: 'model_call_delta', delta: ' world' },
		expect.objectContaining({ type: 'model_call_end', usage: { inputTokens: 10, outputTokens: 2, cachedTokens: 4 } }),
	]));
});
