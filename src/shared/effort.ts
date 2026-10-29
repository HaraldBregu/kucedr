import type { ModelReasoningEffort } from './agent_types';
import type { ModelMetadata } from './model_types';

const ORDER: readonly ModelReasoningEffort[] = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

export function modelEfforts(metadata?: ModelMetadata): ModelReasoningEffort[] {
	const inputs = metadata?.inputs;
	const schema = inputs?.reasoning?.properties?.effort ?? inputs?.output_config?.properties?.effort;
	return ORDER.filter((effort) => schema?.enum?.includes(effort));
}

export function resolveModelEffort(effort: ModelReasoningEffort | undefined, levels: readonly ModelReasoningEffort[]): ModelReasoningEffort | undefined {
	if (!effort || levels.length === 0) return undefined;
	if (levels.includes(effort)) return effort;
	const index = ORDER.indexOf(effort);
	return levels.reduce((closest, level) =>
		Math.abs(ORDER.indexOf(level) - index) < Math.abs(ORDER.indexOf(closest) - index) ? level : closest
	);
}
