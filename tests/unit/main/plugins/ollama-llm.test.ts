import { LlmModel } from '../../../../src/main/models/adapters/llm';

it('uses an SDK placeholder for a no-auth local provider without storing a key', async () => {
	const create = jest.fn().mockResolvedValue({ choices: [], usage: {} });
	const factory = jest.fn(() => ({ chat: { completions: { create } } }) as never);
	const model = new LlmModel({ openAIClientFactory: factory });
	for await (const _event of model.stream({
		provider: { id: 'ollama', apiKey: '', baseURL: 'http://localhost:11434/v1', authentication: 'none' },
		model: 'llama3.2:latest', messages: [{ role: 'user', content: 'hello' }], maxTokens: 100, streaming: false,
	})) { void _event; }
	expect(factory).toHaveBeenCalledWith({ apiKey: 'unused', baseURL: 'http://localhost:11434/v1' });
	expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'llama3.2:latest' }), expect.anything());
});
