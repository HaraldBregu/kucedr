import type { CatalogModel } from '@shared/model_types';
import { mergeModels } from '@/lib/merge-models';

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
	return mergeModels(pluginModels, live.flat(), (model) =>
		JSON.stringify([model.provider.id, model.type, model.id])
	);
}
