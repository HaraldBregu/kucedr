import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { modelTools } from '../../../../src/main/agent/tools/model/tools';

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

it('validates and sends decision, FIM and edit requests using the OpenAI SDK transport', async () => {
	const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () =>
		new Response(JSON.stringify({ result: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } })
	);
	try {
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
			messages: [{ role: 'user', content: '<|recently_viewed_code_snippets|>\n<|/recently_viewed_code_snippets|>\n<|edit_diff_history|>\n<|/edit_diff_history|>\n<|current_file_content|>\nx\n<|/current_file_content|>\n<|code_to_edit|>\nx<|cursor|>\n<|/code_to_edit|>' }],
		}],
	] as const;
	for (const [id, endpoint, model, input] of requests) {
		const operation = tools.find((entry) => entry.id === id);
		expect(operation).toBeDefined();
		await expect(operation!.run(input)).resolves.toEqual({ result: 'ok' });
		const [url, init] = fetchMock.mock.calls.at(-1)!;
		expect(String(url)).toBe(`https://api.inceptionlabs.ai/v1${endpoint}`);
		expect(init?.method).toBe('POST');
		expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-key');
		expect(JSON.parse(String(init?.body))).toEqual({ ...input, model });
	}
	const fim = tools.find((entry) => entry.id === 'mdl__inception__mercury-edit-2_fim')!;
	await expect(fim.run({ prompt: 'hello', top_k: 0 })).rejects.toThrow();
	expect(fetchMock).toHaveBeenCalledTimes(3);
	} finally {
		fetchMock.mockRestore();
	}
});
