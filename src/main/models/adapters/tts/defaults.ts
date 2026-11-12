import type { ModelInputSchema, ModelMetadata } from '../../../../shared/model_types';

export function inputDefault(
	metadata: ModelMetadata | undefined,
	path: readonly string[]
): ModelInputSchema['default'] {
	let input = metadata?.inputs[path[0]];
	for (const key of path.slice(1)) input = input?.properties?.[key];
	return input?.default ?? input?.enum?.[0];
}
