import { readdirSync } from 'node:fs';
import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { loadModels, loadProviders } from '../../../../src/main/models';

jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => path.resolve('tests/fixtures/nonexistent-user-data'),
}));

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => readdirSync(path.resolve('resources/plugins'), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((entry) => {
			const directory = path.resolve('resources/plugins', entry.name);
			const plugin = readPlugin(directory, entry.name, true);
			return plugin.provider
				? [{ directory, manifest: plugin.provider, plugin: { id: entry.name, name: plugin.title } }]
				: [];
		}),
}));

it('loads every bundled model through plugin validation and the catalog without silently dropping entries', () => {
	const root = path.resolve('resources/plugins');
	const expected: string[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const plugin = readPlugin(path.join(root, entry.name), entry.name, true);
		const models = plugin.provider?.models ?? [];
		const ids = models.map((model) => `${model.type}/${model.id}`);
		expect(new Set(ids).size).toBe(ids.length);
		if (models.length) expect(loadProviders().some((provider) => provider.id === entry.name)).toBe(true);
		for (const model of models) {
			if (!model.discoveryOnly) expected.push(`${entry.name}/${model.id}`);
		}
	}
	const actual = loadModels().map((model) => `${model.provider.id}/${model.id}`);
	expect(expected.length).toBeGreaterThan(0);
	expect(actual.sort()).toEqual(expected.sort());
});
