import path from 'node:path';
import OpenAI from 'openai';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { modelTools } from '../../../../src/main/agent/tools/model/tools';

jest.mock('openai');
jest.mock('../../../../src/main/settings_store', () => ({
	getProvider: () => ({ apiKey: 'test-key', baseUrl: 'https://api.inceptionlabs.ai/v1' }),
}));
jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => {
		const directory = path.resolve('resources/plugins/inception');
		const plugin = readPlugin(directory, 'inception', true);
		return [{ directory, manifest: plugin.provider, plugin: { id: 'inception', name: 'Inception' } }];
	},
}));

it('validates and sends decision, FIM and edit requests using the plugin contracts', async () => {
	const post = jest.fn().mockResolvedValue({ result: 'ok' });
	jest.mocked(OpenAI).mockImplementation(() => ({ post }) as never);
	const tools = modelTools();
	const requests = [
		['mdl__inception__mercury-decide_decision', '/decisions', 'mercury-decide', {
			state: { message: 'Refund me' }, questions: {
				billing: { type: 'noul', instructions: 'Is this billing?' },
				request: { type: 'extract', source: 'message', criteria: { request: 'The request' } },
			},
		}],
		['mdl__inception__mercury-edit-2_fim', '/fim/completions', 'mercury-edit-2', {
			prompt: 'return ', suffix: '\n', max_tokens: 256,
		}],
		['mdl__inception__mercury-edit-2_edit', '/edit/completions', 'mercury-edit-2', {
			messages: [{ role: 'user', content: '<|code_to_edit|>x<|cursor|><|/code_to_edit|>' }],
		}],
	] as const;
	for (const [id, endpoint, model, input] of requests) {
		const operation = tools.find((entry) => entry.id === id);
		expect(operation).toBeDefined();
		await expect(operation!.run(input)).resolves.toEqual({ result: 'ok' });
		expect(post).toHaveBeenLastCalledWith(endpoint, { body: { ...input, model }, signal: undefined });
	}
});
