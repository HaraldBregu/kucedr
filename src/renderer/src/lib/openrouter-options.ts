import { updateModelOptions } from './options';

export function updateOpenRouterOptions(
	values: Readonly<Record<string, unknown>>,
	path: readonly string[],
	value: unknown
): Record<string, unknown> {
	let next = updateModelOptions(values, path, value);
	if (path[0] !== 'reasoning' || value === undefined || value === '') return next;
	if (path[1] === 'effort' || path[1] === 'max_tokens') {
		next = updateModelOptions(next, ['reasoning', path[1] === 'effort' ? 'max_tokens' : 'effort'], undefined);
		next = updateModelOptions(next, ['reasoning', 'enabled'], undefined);
	} else if (path[1] === 'enabled' && value === false) {
		next = updateModelOptions(next, ['reasoning', 'effort'], undefined);
		next = updateModelOptions(next, ['reasoning', 'max_tokens'], undefined);
	}
	return next;
}
