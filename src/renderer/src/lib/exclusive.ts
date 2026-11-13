import type { ModelInputSchema } from '@shared/model_types';
import { updateModelOptions } from './options';

export function exclusive(
	values: Readonly<Record<string, unknown>>,
	path: readonly string[],
	value: unknown,
	schema: ModelInputSchema | undefined
): Record<string, unknown> {
	let next = updateModelOptions(values, path, value);
	if (!schema?.exclusive || path.length !== 2 || value === undefined || value === '' || value === true) return next;
	for (const key of Object.keys(schema.properties ?? {}))
		if (key !== path[1]) next = updateModelOptions(next, [path[0], key], undefined);
	return next;
}
