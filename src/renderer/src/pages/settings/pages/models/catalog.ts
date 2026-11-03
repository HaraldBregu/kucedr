import type { CatalogModel } from '@shared/model_types';

export async function loadModelCatalog(): Promise<CatalogModel[]> {
	const [catalog, providers] = await Promise.all([
		window.app.models(),
		window.provider.getModelProviders(),
	]);
	const live = await Promise.all(
		providers
			.filter((provider) => provider.plugin && provider.modelsUrl)
			.map(async (provider) =>
				(await window.provider.listModels(provider.id).catch(() => [])).map(
					(model): CatalogModel => ({ ...model, type: 'llm', location: 'remote', provider })
				)
			)
	);
	const pluginModels = catalog.filter((model) => model.provider.plugin);
	const ids = new Set(pluginModels.map((model) => `${model.provider.id}/${model.id}`));
	return [
		...pluginModels,
		...live.flat().filter((model) => !ids.has(`${model.provider.id}/${model.id}`)),
	];
}
