const registerQueryWithEvent = jest.fn();
const registerCommandWithEvent = jest.fn();
const getProvider = jest.fn();
const listProviders = jest.fn();
const setProvider = jest.fn();
const deleteProvider = jest.fn();
const getEnabledPluginProviders = jest.fn();
const setPluginProviderEnabled = jest.fn();

jest.mock('../../../../src/main/ipc/core/gateway', () => ({
	registerQueryWithEvent,
	registerCommandWithEvent,
}));

jest.mock('../../../../src/main/ipc/core/trusted', () => ({
	TrustedRenderer: class {
		assert = jest.fn();
	},
}));

jest.mock('../../../../src/main/settings_store', () => ({
	getProvider,
	listProviders,
	setProvider,
	deleteProvider,
}));

jest.mock('../../../../src/main/providers/providers_store', () => ({
	getEnabledPluginProviders,
	setPluginProviderEnabled,
}));

jest.mock('../../../../src/main/models', () => ({
	loadProviders: () => [
		{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
		{ id: 'openrouter', name: 'OpenRouter', modelsUrl: 'https://openrouter.ai/api/v1/models' },
	],
	loadVectorDatabases: () => [
		{
			id: 'pinecone',
			provider: { id: 'pinecone', name: 'Pinecone', baseUrl: '' },
			url: 'https://api.pinecone.io',
		},
	],
	loadStorages: () => [{ id: 'cloudflare-r2', provider: { id: 'cloudflare' } }],
}));

import type { EventBus } from '../../../../src/main/event_bus';
import { ProviderStoreIpc } from '../../../../src/main/ipc/provider';
import { ProviderChannels } from '../../../../src/shared/ipc_channels_definitions';

function handler(registration: jest.Mock, channel: string): (...args: unknown[]) => unknown {
	const call = registration.mock.calls.find(([registered]) => registered === channel);
	if (!call) throw new Error(`Missing handler for ${channel}`);
	return call[1] as (...args: unknown[]) => unknown;
}

function register() {
	new ProviderStoreIpc().register({ windows: {} as never, apps: {} as never }, {} as EventBus);
}

beforeEach(() => {
	registerQueryWithEvent.mockClear();
	registerCommandWithEvent.mockClear();
	getEnabledPluginProviders.mockReturnValue({ database: [], storage: [] });
});

describe('provider credential IPC boundary', () => {
	it('removes a saved provider key from the requested collection', () => {
		register();
		handler(registerCommandWithEvent, ProviderChannels.remove)({}, 'Pinecone', 'databases');
		expect(deleteProvider).toHaveBeenCalledWith('pinecone', 'databases');
	});

	it('returns API keys from get and list', async () => {
		register();
		const provider = {
			id: 'openai',
			name: 'OpenAI',
			baseUrl: 'https://api.openai.com/v1',
			apiKey: 'provider-secret',
		};
		getProvider.mockReturnValue(provider);
		listProviders.mockReturnValue([provider]);

		const getResult = await handler(registerQueryWithEvent, ProviderChannels.get)(
			{},
			'openai',
			'models'
		);
		const listResult = await handler(registerQueryWithEvent, ProviderChannels.list)({}, 'models');

		expect(getResult).toEqual(provider);
		expect(listResult).toEqual([provider]);
	});

	it('saves and returns the submitted API key', async () => {
		register();
		const provider = {
			id: 'openai',
			name: 'OpenAI',
			apiKey: 'provider-secret',
			baseUrl: 'https://api.openai.com/v1',
		};
		setProvider.mockReturnValue(provider);

		const result = await handler(registerCommandWithEvent, ProviderChannels.set)(
			{},
			{
				kind: 'models',
				id: 'openai',
				apiKey: 'provider-secret',
			}
		);

		expect(setProvider).toHaveBeenCalledWith(
			{
				id: 'openai',
				name: 'OpenAI',
				apiKey: 'provider-secret',
				baseUrl: 'https://api.openai.com/v1',
			},
			'models'
		);
		expect(result).toEqual(provider);
	});

	it('saves a custom OpenAI-compatible model provider', () => {
		register();
		const provider = {
			id: 'custom',
			name: 'Custom model provider',
			apiKey: 'custom-key',
			baseUrl: 'https://models.example/v1',
		};
		setProvider.mockReturnValue(provider);

		const result = handler(registerCommandWithEvent, ProviderChannels.set)(
			{},
			{
				kind: 'models',
				id: 'custom',
				apiKey: 'custom-key',
				baseUrl: 'https://models.example/v1/',
			}
		);

		expect(setProvider).toHaveBeenCalledWith(provider, 'models');
		expect(result).toEqual(provider);
	});

	it('rejects custom providers without an HTTP base URL', () => {
		register();

		expect(() =>
			handler(registerCommandWithEvent, ProviderChannels.set)(
				{},
				{
					kind: 'models',
					id: 'custom',
					apiKey: 'custom-key',
					baseUrl: 'file:///tmp/model',
				}
			)
		).toThrow('The provider base URL is invalid.');
	});

	it('lists model IDs from a custom OpenAI-compatible provider', async () => {
		register();
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				data: [{ id: 'model-a' }, { id: 'model-b' }, { id: 'model-a' }, {}, { id: ' ' }],
			}),
		});
		global.fetch = fetchMock;

		const result = await handler(registerQueryWithEvent, ProviderChannels.listCustomModels)(
			{},
			{ baseUrl: 'https://models.example/v1', apiKey: 'custom-key' }
		);

		expect(result).toEqual(['model-a', 'model-b']);
		expect(fetchMock).toHaveBeenCalledWith('https://models.example/v1/models', {
			signal: expect.any(AbortSignal),
			headers: { Authorization: 'Bearer custom-key' },
		});
	});

	it('lists custom models without a token', async () => {
		register();
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ data: [{ id: 'model-a' }] }),
		});
		global.fetch = fetchMock;

		const result = await handler(registerQueryWithEvent, ProviderChannels.listCustomModels)(
			{},
			{ baseUrl: 'https://models.example/v1', apiKey: '' }
		);

		expect(result).toEqual(['model-a']);
		expect(fetchMock).toHaveBeenCalledWith('https://models.example/v1/models', {
			signal: expect.any(AbortSignal),
			headers: {},
		});
	});

	it('returns no models when the local provider is offline', async () => {
		register();
		global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));

		const result = await handler(registerQueryWithEvent, ProviderChannels.listCustomModels)(
			{},
			{ baseUrl: 'https://models.example/v1', apiKey: 'custom-key' }
		);

		expect(result).toEqual([]);
	});

	it('saves and lists database credentials separately from model credentials', () => {
		setProvider.mockClear();
		getEnabledPluginProviders.mockReturnValue({ database: ['pinecone/pinecone'], storage: [] });
		register();
		const provider = {
			id: 'pinecone',
			name: 'Pinecone',
			baseUrl: 'https://api.pinecone.io',
			apiKey: 'database-secret',
		};
		setProvider.mockReturnValue(provider);
		listProviders.mockReturnValue([provider]);

		const saved = handler(registerCommandWithEvent, ProviderChannels.set)(
			{},
			{
				kind: 'databases',
				id: 'pinecone',
				apiKey: ' database-secret ',
			}
		);
		const listed = handler(registerQueryWithEvent, ProviderChannels.list)({}, 'databases');

		expect(setProvider).toHaveBeenCalledWith(
			{
				id: 'pinecone',
				name: 'Pinecone',
				apiKey: 'database-secret',
				baseUrl: 'https://api.pinecone.io',
			},
			'databases'
		);
		expect(listProviders).toHaveBeenCalledWith('databases');
		expect(saved).toEqual(provider);
		expect(listed).toEqual([provider]);
		expect(() =>
			handler(registerCommandWithEvent, ProviderChannels.set)(
				{},
				{
					kind: 'models',
					id: 'pinecone',
					apiKey: 'database-secret',
				}
			)
		).toThrow('Unknown provider.');
		expect(setProvider).toHaveBeenCalledTimes(1);
	});

	it('enables only database and storage entries in the catalog', () => {
		register();
		setPluginProviderEnabled.mockReturnValue({ database: ['pinecone/pinecone'], storage: [] });
		const setEnabled = handler(registerCommandWithEvent, ProviderChannels.setPluginEnabled);
		expect(setEnabled({}, 'database', 'pinecone/pinecone', true)).toEqual({
			database: ['pinecone/pinecone'],
			storage: [],
		});
		expect(() => setEnabled({}, 'database', 'unknown/provider', true)).toThrow(
			'Unknown plugin provider'
		);
		expect(() => setEnabled({}, 'storage', 'unknown/provider', true)).toThrow(
			'Unknown plugin provider'
		);
	});
});

it('exposes OpenRouter model capabilities and exact reasoning levels from its model list', async () => {
	register();
	const originalFetch = global.fetch;
	global.fetch = jest.fn().mockResolvedValue({
		ok: true,
		json: async () => ({
			data: [
				{
					id: 'known',
					name: 'Known',
					supported_parameters: ['reasoning', 'temperature', 'top_p', 'seed', 'unknown'],
					default_parameters: { temperature: 0.7, top_p: null, seed: 7 },
					reasoning: {
						mandatory: true,
						supported_efforts: ['none', 'high', 'low'],
						default_effort: 'high',
						supports_max_tokens: true,
					},
					context_length: 8192,
				},
				{
					id: 'null',
					supported_parameters: ['reasoning_effort'],
					reasoning: { supported_efforts: null },
				},
				{ id: 'missing', supported_parameters: ['reasoning'], reasoning: {} },
				{ id: 'unsupported', supported_parameters: ['temperature'] },
			],
		}),
	});
	try {
		const models = (await handler(registerQueryWithEvent, ProviderChannels.listModels)(
			{},
			'openrouter'
		)) as Array<{
			id: string;
			metadata: { documentationStatus: string; inputs: Record<string, any> };
		}>;
		const known = models.find((item) => item.id === 'known')!.metadata;
		expect(known.documentationStatus).toBe('verified');
		expect(known.inputs).toEqual({
			temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
			top_p: { type: 'number', minimum: 0, maximum: 1 },
			seed: { type: 'integer', default: 7 },
			reasoning: {
				type: 'object',
				properties: {
					effort: { type: 'string', enum: ['low', 'high'], default: 'high' },
					max_tokens: { type: 'integer', minimum: 0 },
				},
			},
		});
		expect(
			models.find((item) => item.id === 'null')!.metadata.inputs.reasoning.properties.effort.enum
		).toEqual(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
		expect(models.find((item) => item.id === 'missing')!.metadata.inputs.reasoning).toBeUndefined();
		expect(
			models.find((item) => item.id === 'unsupported')!.metadata.inputs.reasoning
		).toBeUndefined();
	} finally {
		global.fetch = originalFetch;
	}
});
