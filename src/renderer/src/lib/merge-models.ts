import type { ProviderModel } from '@shared/model_types';

export function mergeModels<T extends ProviderModel>(
	fallback: readonly T[],
	live: readonly T[],
	key: (model: T) => string = (model) => model.id
): T[] {
	const result = [...fallback];
	const indexes = new Map(result.map((model, index) => [key(model), index]));
	for (const model of live) {
		const id = key(model);
		const index = indexes.get(id);
		if (index === undefined) {
			indexes.set(id, result.length);
			result.push(model);
			continue;
		}
		const previous = result[index];
		result[index] = {
			...previous,
			...model,
			discovered: previous.discovered ?? false,
			...(model.metadata && previous.metadata
				? { metadata: { ...previous.metadata, ...model.metadata } }
				: {}),
		};
	}
	return result;
}
