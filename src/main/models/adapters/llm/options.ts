import type { ModelEffort } from '../../../../shared/model_types';
import type { LlmStreamRequest } from './llm_types';
import { llmIsRecord } from './llm_shared';
import { merge } from './merge';

export function options(
	effort: ModelEffort | undefined,
	request: LlmStreamRequest
): Record<string, unknown> {
	let configured: Record<string, unknown> = { ...request.options };
	if (!effort) return configured;
	if (request.effort) {
		if (effort.unset?.length) configured = structuredClone(configured);
		for (const path of effort.unset ?? []) {
			const keys = path.split('.');
			const parent = keys
				.slice(0, -1)
				.reduce<unknown>((value, key) => (llmIsRecord(value) ? value[key] : undefined), configured);
			if (llmIsRecord(parent)) delete parent[keys[keys.length - 1]];
		}
		const written = effort.path
			.split('.')
			.reduceRight<unknown>(
				(nested, key) => ({ [key]: nested }),
				effort.map?.[request.effort] ?? request.effort
			) as Record<string, unknown>;
		configured = merge(configured, written);
		if (effort.set) configured = merge(configured, effort.set);
	}
	const roots = [effort.path, ...(effort.unset ?? [])].map((path) => path.split('.')[0]);
	if (effort.setWhenPresent && roots.some((key) => configured[key]))
		configured = merge(configured, effort.setWhenPresent);
	return configured;
}
