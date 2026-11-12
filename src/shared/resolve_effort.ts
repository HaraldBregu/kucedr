import type { ModelReasoningEffort } from './agent_types';

const ORDER: Record<ModelReasoningEffort, number> = { none: 0, instant: 0.5, minimal: 1, low: 2, medium: 3, high: 4, xhigh: 5, max: 6 };

export function resolveModelEffort(effort: ModelReasoningEffort | undefined, levels: readonly ModelReasoningEffort[]): ModelReasoningEffort | undefined {
	if (!effort || levels.length === 0) return undefined;
	if (levels.includes(effort)) return effort;
	const index = ORDER[effort];
	return levels.reduce((closest, level) =>
		Math.abs(ORDER[level] - index) < Math.abs(ORDER[closest] - index) ? level : closest
	);
}
