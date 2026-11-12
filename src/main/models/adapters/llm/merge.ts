import { llmIsRecord } from './llm_shared';

export function merge(
	target: Readonly<Record<string, unknown>>,
	source: Readonly<Record<string, unknown>>
): Record<string, unknown> {
	const next: Record<string, unknown> = { ...target };
	for (const [key, value] of Object.entries(source)) {
		const current = next[key];
		next[key] = llmIsRecord(value) && llmIsRecord(current) ? merge(current, value) : value;
	}
	return next;
}
