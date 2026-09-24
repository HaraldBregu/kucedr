const registerQueryWithEvent = jest.fn();
const registerCommandWithEvent = jest.fn();
const getProvider = jest.fn();
const listProviders = jest.fn();
const setProvider = jest.fn();
const deleteProvider = jest.fn();
const getChannelProvider = jest.fn();
const listChannelProviders = jest.fn();
const setChannelProvider = jest.fn();
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

jest.mock('../../../../src/main/channels', () => ({
	getChannelProvider,
	listChannelProviders,
	setChannelProvider,
	loadChannels: () => [
		{
			id: 'telegram-bot',
			provider: { id: 'telegram', name: 'Telegram', baseUrl: 'https://api.telegram.org' },
			url: 'https://api.telegram.org',
		},
	],
}));

jest.mock('../../../../src/main/models', () => ({
	loadProviders: () => [{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }],
	loadDatabases: () => [
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
			name: 'Local model provider',
			apiKey: 'ollama',
			baseUrl: 'http://localhost:11434/api',
		};
		setProvider.mockReturnValue(provider);

		const result = handler(registerCommandWithEvent, ProviderChannels.set)(
			{},
			{
				kind: 'models',
				id: 'custom',
				apiKey: 'ollama',
				baseUrl: 'http://localhost:11434/api/',
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
					apiKey: 'ollama',
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
				models: [{ name: 'llama3.2:3b' }, { name: 'qwen3:8b' }, { name: 'llama3.2:3b' }, {}],
			}),
		});
		global.fetch = fetchMock;

		const result = await handler(registerQueryWithEvent, ProviderChannels.listCustomModels)(
			{},
			{ baseUrl: 'http://localhost:11434/api', apiKey: 'ollama' }
		);

		expect(result).toEqual(['llama3.2:3b', 'qwen3:8b']);
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags', {
			signal: expect.any(AbortSignal),
		});
	});

	it('lists Ollama models without a token', async () => {
		register();
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ models: [{ name: 'llama3.2:3b' }] }),
		});
		global.fetch = fetchMock;

		const result = await handler(registerQueryWithEvent, ProviderChannels.listCustomModels)(
			{},
			{ baseUrl: 'http://localhost:11434/api', apiKey: '' }
		);

		expect(result).toEqual(['llama3.2:3b']);
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags', {
			signal: expect.any(AbortSignal),
		});
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
		expect(setEnabled({}, 'database', 'pinecone/pinecone', true)).toEqual({ database: ['pinecone/pinecone'], storage: [] });
		expect(() => setEnabled({}, 'database', 'unknown/provider', true)).toThrow('Unknown plugin provider');
		expect(() => setEnabled({}, 'storage', 'unknown/provider', true)).toThrow('Unknown plugin provider');
	});

	it('rejects saving a channel that is absent from the supported catalog', () => {
		register();

		expect(() =>
			handler(registerCommandWithEvent, ProviderChannels.setChannel)(
				{},
				{
					id: 'unsupported',
					apiKey: 'bot-secret',
				}
			)
		).toThrow('Unknown channel provider.');
		expect(setChannelProvider).not.toHaveBeenCalled();
	});

	it('omits unsupported saved channels from queries without changing stored credentials', () => {
		register();
		listChannelProviders.mockReturnValue([
			{ id: 'unsupported', name: 'Unsupported', baseUrl: '', apiKey: 'old-secret' },
			{ id: 'telegram', name: 'Telegram', baseUrl: '', apiKey: 'bot-secret' },
		]);

		expect(handler(registerQueryWithEvent, ProviderChannels.listChannels)({})).toEqual([
			{ id: 'telegram', name: 'Telegram', baseUrl: '', configured: true },
		]);
		expect(
			handler(registerQueryWithEvent, ProviderChannels.getChannel)({}, 'unsupported')
		).toBeUndefined();
		expect(setChannelProvider).not.toHaveBeenCalled();
	});

	it('does not expose bot tokens through the split bot query', async () => {
		register();
		getChannelProvider.mockReturnValue({
			id: 'telegram',
			name: 'Telegram',
			apiKey: 'bot-secret',
			baseUrl: 'https://api.telegram.org',
			dmPolicy: 'allowlist',
		});

		const result = await handler(registerQueryWithEvent, ProviderChannels.getChannel)(
			{},
			'telegram'
		);

		expect(result).toEqual({
			id: 'telegram',
			name: 'Telegram',
			baseUrl: 'https://api.telegram.org',
			dmPolicy: 'allowlist',
			configured: true,
		});
		expect(JSON.stringify(result)).not.toContain('bot-secret');
	});
});
