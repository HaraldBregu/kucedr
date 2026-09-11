const registerQueryWithEvent = jest.fn();
const registerCommandWithEvent = jest.fn();
const getProvider = jest.fn();
const listProviders = jest.fn();
const setProvider = jest.fn();
const getChannelProvider = jest.fn();
const listChannelProviders = jest.fn();
const setChannelProvider = jest.fn();

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
	loadProviders: () => [
		{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
	],
	loadDatabases: () => [
		{
			id: 'pinecone',
			provider: { id: 'pinecone', name: 'Pinecone', baseUrl: '' },
			url: 'https://api.pinecone.io',
		},
	],
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
	new ProviderStoreIpc().register(
		{ windows: {} as never, apps: {} as never },
		{} as EventBus
	);
}

beforeEach(() => {
	registerQueryWithEvent.mockClear();
	registerCommandWithEvent.mockClear();
});

describe('provider credential IPC boundary', () => {
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

		const result = await handler(registerCommandWithEvent, ProviderChannels.set)({}, {
			kind: 'models',
			id: 'openai',
			apiKey: 'provider-secret',
		});

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

	it('saves and lists database credentials separately from model credentials', () => {
		setProvider.mockClear();
		register();
		const provider = {
			id: 'pinecone',
			name: 'Pinecone',
			baseUrl: 'https://api.pinecone.io',
			apiKey: 'database-secret',
		};
		setProvider.mockReturnValue(provider);
		listProviders.mockReturnValue([provider]);

		const saved = handler(registerCommandWithEvent, ProviderChannels.set)({}, {
			kind: 'databases',
			id: 'pinecone',
			apiKey: ' database-secret ',
		});
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
			handler(registerCommandWithEvent, ProviderChannels.set)({}, {
				kind: 'models',
				id: 'pinecone',
				apiKey: 'database-secret',
			})
		).toThrow('Unknown provider.');
		expect(setProvider).toHaveBeenCalledTimes(1);
	});

	it('rejects saving a channel that is absent from the supported catalog', () => {
		register();

		expect(() =>
			handler(registerCommandWithEvent, ProviderChannels.setChannel)({}, {
				id: 'unsupported',
				apiKey: 'bot-secret',
			})
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
		expect(handler(registerQueryWithEvent, ProviderChannels.getChannel)({}, 'unsupported'))
			.toBeUndefined();
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

		const result = await handler(registerQueryWithEvent, ProviderChannels.getChannel)({}, 'telegram');

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
