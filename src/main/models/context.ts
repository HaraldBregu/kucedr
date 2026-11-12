import { findModel } from '../models';
import { modelContextWindow } from '../../shared/model_context';
import type { ResolvedProvider } from '../../shared/provider_types';
import { liveModelLimits } from './live';

export async function resolveContextWindow(
	provider: ResolvedProvider | undefined,
	modelId: string
): Promise<number | undefined> {
	if (!provider) return undefined;
	const known = modelContextWindow(findModel(provider.id, 'llm', modelId)?.metadata);
	if (known) return known;
	return (await liveModelLimits(provider.id, modelId))?.contextWindow;
}
