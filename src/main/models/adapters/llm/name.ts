import type { LlmProviderSpec } from './llm_types';

export function providerName(provider: LlmProviderSpec): string {
	return provider.name ?? provider.id;
}
