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
	const sync = {
		getSummary: jest.fn(),
		listSummaries: jest.fn(),
		status: jest.fn(),
		refreshStatus: jest.fn(),
		setup: jest.fn(),
		unlock: jest.fn(),
		changePassphrase: jest.fn(),
		sync: jest.fn(),
	};
	new ProviderStoreIpc().register(
		{ sync: sync as never, windows: {} as never, apps: {} as never },
		{} as EventBus
	);
	return sync;
}

beforeEach(() => {
	registerQueryWithEvent.mockClear();
	registerCommandWithEvent.mockClear();
});

describe('provider credential IPC boundary', () => {
	it('awaits refreshed vault readiness for the public status query', async () => {
		const sync = register();
		const status = {
			persistence: 'encrypted',
			cloudConfigured: true,
			unlocked: false,
			pending: 0,
		};
		sync.refreshStatus.mockResolvedValue(status);

		await expect(
			handler(registerQueryWithEvent, ProviderChannels.vaultStatus)({})
		).resolves.toEqual(status);
		expect(sync.refreshStatus).toHaveBeenCalledTimes(1);
		expect(sync.status).not.toHaveBeenCalled();
	});

	it('returns summaries without API keys from get and list', async () => {
		const sync = register();
		const summary = {
			kind: 'models',
			id: 'openai',
			name: 'OpenAI',
			baseUrl: 'https://api.openai.com/v1',
			configured: true,
			syncStatus: 'local',
		};
		sync.getSummary.mockReturnValue(summary);
		sync.listSummaries.mockReturnValue([summary]);

		const getResult = await handler(registerQueryWithEvent, ProviderChannels.get)(
			{},
			'openai',
			'models'
		);
		const listResult = await handler(registerQueryWithEvent, ProviderChannels.list)({}, 'models');

		expect(JSON.stringify({ getResult, listResult })).not.toContain('apiKey');
		expect(JSON.stringify({ getResult, listResult })).not.toContain('provider-secret');
	});

	it('accepts a key-only save input and never returns the submitted key', async () => {
		const sync = register();
		const summary = {
			kind: 'models',
			id: 'openai',
			name: 'OpenAI',
			baseUrl: 'https://api.openai.com/v1',
			configured: true,
			syncStatus: 'pending',
		};
		sync.getSummary.mockReturnValue(summary);

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
		expect(JSON.stringify(result)).not.toContain('provider-secret');
		expect(JSON.stringify(result)).not.toContain('apiKey');
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
