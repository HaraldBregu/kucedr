import type { CloudCredentialService } from '@shared/credential_types';

export const SERVICE_NAMES: Record<CloudCredentialService, string> = {
	openai: 'OpenAI',
	anthropic: 'Anthropic',
	deepseek: 'DeepSeek',
	mistral: 'Mistral AI',
	xai: 'xAI',
};
