import type { CloudCredentialService } from '../../shared/credential_types';

interface Service {
	baseURL: string;
	test: string;
	headers: (key: string) => Record<string, string>;
}

const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

export const CLOUD_SERVICES: Record<CloudCredentialService, Service> = {
	openai: { baseURL: 'https://api.openai.com/v1', test: '/models', headers: bearer },
	anthropic: {
		baseURL: 'https://api.anthropic.com',
		test: '/v1/models',
		headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
	},
	deepseek: { baseURL: 'https://api.deepseek.com', test: '/models', headers: bearer },
	mistral: { baseURL: 'https://api.mistral.ai/v1', test: '/models', headers: bearer },
	xai: { baseURL: 'https://api.x.ai/v1', test: '/models', headers: bearer },
};
