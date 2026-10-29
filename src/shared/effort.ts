import type { ModelReasoningEffort } from './agent_types';
import type { ModelMetadata } from './model_types';

const ORDER: readonly ModelReasoningEffort[] = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

export function modelEfforts(metadata?: ModelMetadata): ModelReasoningEffort[] {
	const inputs = metadata?.inputs;
	const schema = inputs?.reasoning?.properties?.effort ?? inputs?.output_config?.properties?.effort;
	return ORDER.filter((effort) => schema?.enum?.includes(effort));
}
