import { leaks } from '../../../../shield/leaks';
import type { BrowserAct } from './act';

export function secret(params: Pick<BrowserAct, 'kind' | 'text' | 'fields' | 'fn'>): boolean {
	const texts =
		params.kind === 'type'
			? [params.text]
			: params.kind === 'fill'
				? (params.fields ?? []).map((field) => field.value)
				: params.kind === 'evaluate'
					? [params.fn]
					: [];
	return texts.some((text) => typeof text === 'string' && leaks(text));
}
