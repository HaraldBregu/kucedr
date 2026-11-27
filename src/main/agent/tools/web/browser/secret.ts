import { leaks } from '../../../../shield/leaks';
import type { BrowserAct } from './act';

export function secret(params: Pick<BrowserAct, 'text' | 'fields' | 'fn' | 'values' | 'selector'>): boolean {
	const texts = [
		params.text,
		params.fn,
		params.selector,
		...(params.values ?? []),
		...(params.fields ?? []).map((field) => field.value),
	];
	return texts.some((text) => typeof text === 'string' && leaks(text));
}
