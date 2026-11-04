import type { ModelReasoningEffort } from './agent_types';
import type { ModelMetadata } from './model_types';

export function modelEfforts(metadata?: ModelMetadata): ModelReasoningEffort[] {
	const inputs = metadata?.inputs;
	const schema =
		inputs?.reasoning?.properties?.effort ??
		inputs?.output_config?.properties?.effort ??
		inputs?.reasoning_effort;
	return (schema?.enum ?? []).filter((effort): effort is ModelReasoningEffort => typeof effort === 'string') as ModelReasoningEffort[];
}
