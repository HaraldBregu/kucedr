import type { ModelCache } from '../../../../shared/model_types';

export function headers(
	cache: ModelCache | undefined,
	sessionId: string | undefined
): Record<string, string> | undefined {
	return cache?.sessionHeader && sessionId ? { [cache.sessionHeader]: sessionId } : undefined;
}
