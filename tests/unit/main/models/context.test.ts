import { resolveContextWindow } from '../../../../src/main/models/context';
import * as catalog from '../../../../src/main/models';
import { loadModels } from '../../../../src/main/models';
import { modelContextWindow } from '../../../../src/shared/model_context';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

afterEach(() => jest.restoreAllMocks());

it('covers every bundled chat model with a documented positive context limit', () => {
	const models = loadModels().filter((model) => model.type === 'llm');
	const root = path.resolve('resources/plugins');
	const expected = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap(({ name: providerId }) => {
		const manifest = JSON.parse(readFileSync(path.join(root, providerId, 'manifest.json'), 'utf8'));
		return (manifest.models ?? [])
			.filter((model: { type: string }) => model.type === 'large-language-model')
			.map((model: { id: string }) => `${providerId}/${model.id}`);
	});
	expect(models.map((model) => `${model.provider.id}/${model.id}`).sort()).toEqual(expected.sort());
	expect(new Set(models.map((model) => model.provider.id)).size).toBe(12);
	for (const model of models) {
		expect(modelContextWindow(model.metadata)).toBeGreaterThan(0);
		expect(model.metadata?.contextWindowDocumentationUrl).toMatch(/^https:\/\//);
	}
});

describe('catalog context resolution', () => {
	it('uses the configured catalog context limit without contacting the provider', async () => {
		const find = jest.spyOn(catalog, 'findModel').mockReturnValue({
			metadata: { contextWindow: 8192 },
		} as never);
		const fetcher = jest.spyOn(globalThis, 'fetch');
		await expect(
			resolveContextWindow({ id: 'openai', apiKey: 'key' }, 'catalog-model')
		).resolves.toBe(8192);
		expect(find).toHaveBeenCalledWith('openai', 'llm', 'catalog-model');
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('keeps an unknown custom context limit unavailable without contacting the provider', async () => {
		jest.spyOn(catalog, 'findModel').mockReturnValue(undefined);
		const fetcher = jest.spyOn(globalThis, 'fetch');
		await expect(
			resolveContextWindow(
				{ id: 'custom', apiKey: 'key', baseURL: 'https://models.example/v1' },
				'custom-model'
			)
		).resolves.toBeUndefined();
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('leaves the context limit unavailable when no provider is selected', async () => {
		const find = jest.spyOn(catalog, 'findModel');
		await expect(resolveContextWindow(undefined, 'model')).resolves.toBeUndefined();
		expect(find).not.toHaveBeenCalled();
	});
});
