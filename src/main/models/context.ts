import { findModel } from '../models';
import { modelContextWindow } from '../../shared/model_context';
import type { ResolvedProvider } from '../../shared/provider_types';

export async function resolveContextWindow(
	provider: ResolvedProvider | undefined,
	modelId: string
): Promise<number | undefined> {
	if (!provider) return undefined;
	return modelContextWindow(findModel(provider.id, 'llm', modelId)?.metadata);
}
