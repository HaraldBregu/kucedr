import type { ModelReasoningEffort } from '../../../shared/agent_types';
import { modelEfforts } from '../../../shared/effort';
import { findModel } from '../../models';

/** A mode's effort applies only if the selected model supports it. */
export function modeEffort(
	effort: ModelReasoningEffort | undefined,
	providerId: string | undefined,
	modelId: string | undefined
): ModelReasoningEffort | undefined {
	if (!effort || !providerId || !modelId) return undefined;
	const model = findModel(providerId, 'llm', modelId);
	return modelEfforts(model?.metadata).includes(effort) ? effort : undefined;
}
