import { resolveContextWindow } from '../../../../src/main/models/context';
import { loadModels } from '../../../../src/main/models';
import { modelContextWindow } from '../../../../src/shared/model_context';

afterEach(() => jest.restoreAllMocks());

it('covers every bundled chat model with a documented positive context limit', () => {
	const models = loadModels().filter((model) => model.type === 'llm');
	expect(models).toHaveLength(40);
	expect(new Set(models.map((model) => model.provider.id)).size).toBe(11);
	for (const model of models) {
		expect(modelContextWindow(model.metadata)).toBeGreaterThan(0);
		expect(model.metadata?.contextWindowDocumentationUrl).toMatch(/^https:\/\//);
	}
});

it('uses explicit Ollama num_ctx without contacting the server', async () => {
	const fetcher = jest.spyOn(globalThis, 'fetch');
	await expect(
		resolveContextWindow({ id: 'ollama', apiKey: '', baseURL: 'http://localhost:11434' }, 'llama', {
			num_ctx: 8192,
		})
	).resolves.toBe(8192);
	expect(fetcher).not.toHaveBeenCalled();
});

it.each(['http://localhost:11434', 'http://localhost:11434/api'])(
	'reads the effective loaded limit from %s',
	async (baseURL) => {
		const fetcher = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue({
				ok: true,
				json: async () => ({ models: [{ name: 'llama:latest', context_length: 4096 }] }),
			} as Response);
		await expect(
			resolveContextWindow({ id: 'ollama', apiKey: '', baseURL }, 'llama')
		).resolves.toBe(4096);
		expect(String(fetcher.mock.calls[0][0])).toBe('http://localhost:11434/api/ps');
	}
);

it('uses persisted num_ctx while an Ollama model is unloaded', async () => {
	const fetcher = jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) } as Response)
		.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				parameters: 'num_ctx 16384\nstop test',
				model_info: { 'llama.context_length': 131072 },
			}),
		} as Response);
	await expect(
		resolveContextWindow(
			{ id: 'custom', apiKey: '', baseURL: 'http://localhost:11434/api' },
			'llama'
		)
	).resolves.toBe(16384);
	expect(String(fetcher.mock.calls[1][0])).toBe('http://localhost:11434/api/show');
});

it('does not confuse advertised capacity with an unknown effective Ollama limit', async () => {
	jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) } as Response)
		.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ model_info: { 'llama.context_length': 131072 } }),
		} as Response);
	await expect(
		resolveContextWindow({ id: 'ollama', apiKey: '', baseURL: 'http://localhost:11434' }, 'llama')
	).resolves.toBeUndefined();
});

it('keeps offline local limits unknown', async () => {
	jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
	await expect(
		resolveContextWindow({ id: 'ollama', apiKey: '', baseURL: 'http://localhost:11434' }, 'llama')
	).resolves.toBeUndefined();
});
