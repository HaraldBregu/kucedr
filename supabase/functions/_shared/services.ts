export interface Service {
	origin: string;
	auth: (key: string) => Record<string, string>;
	defaults?: Record<string, string>;
	operations: Record<string, 'GET' | 'POST'>;
	test: string;
}

const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

// Approved destinations: saved keys are only ever sent to these origins and operations.
export const services: Record<string, Service> = {
	openai: {
		origin: 'https://api.openai.com/v1',
		auth: bearer,
		operations: { '/responses': 'POST', '/chat/completions': 'POST', '/models': 'GET' },
		test: '/models',
	},
	anthropic: {
		origin: 'https://api.anthropic.com',
		auth: (key) => ({ 'x-api-key': key }),
		defaults: { 'anthropic-version': '2023-06-01' },
		operations: { '/v1/messages': 'POST', '/v1/messages/count_tokens': 'POST', '/v1/models': 'GET' },
		test: '/v1/models',
	},
	deepseek: {
		origin: 'https://api.deepseek.com',
		auth: bearer,
		operations: { '/chat/completions': 'POST', '/models': 'GET' },
		test: '/models',
	},
	mistral: {
		origin: 'https://api.mistral.ai/v1',
		auth: bearer,
		operations: { '/chat/completions': 'POST', '/models': 'GET' },
		test: '/models',
	},
	xai: {
		origin: 'https://api.x.ai/v1',
		auth: bearer,
		operations: { '/chat/completions': 'POST', '/models': 'GET' },
		test: '/models',
	},
};
