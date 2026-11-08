import type { z } from 'zod';
import type { ModelCapability } from '../../../../shared/model_types';
import { findModel, providerModels } from '../../../models';
import { getModelId, getProviderId, type MediaModelKind } from '../../../models/selection';
import { modelOption } from './option';

const EXCLUDED_INPUTS = new Set(['n', 'response_format']);

export function modelOptions(
	kind: MediaModelKind,
	capability: ModelCapability
): { model?: string; shape: Record<string, z.ZodType> } {
	const providerId = getProviderId(kind);
	if (!providerId) return { shape: {} };
	const modelId = getModelId(kind) ?? providerModels(providerId, capability)[0]?.id;
	const model = modelId ? findModel(providerId, capability, modelId) : undefined;
	if (model?.metadata?.documentationStatus !== 'verified') return { shape: {} };
	const shape: Record<string, z.ZodType> = {};
	for (const [key, input] of Object.entries(model.metadata.inputs)) {
		const option = EXCLUDED_INPUTS.has(key) ? undefined : modelOption(input);
		if (option) shape[key] = option;
	}
	return { model: model.name, shape };
}
