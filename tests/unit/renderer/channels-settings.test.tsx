import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type {
	ChannelCredentialSummary,
	ChannelModelKind,
} from '../../../src/shared/channels_types';
import ChannelsPage from '../../../src/renderer/src/pages/settings/pages/channels/Page';
import ChannelDetailsPage from '../../../src/renderer/src/pages/settings/pages/channels/details/Page';
import ChannelsConfigurationPage from '../../../src/renderer/src/pages/settings/pages/channels/Configuration';
import {
	modelsFor,
	providerIdsFor,
	providerModels,
	providers,
	supportsSpeechToTextApiType,
} from '../../../src/renderer/src/lib/providers';

jest.mock('../../../src/renderer/src/lib/providers', () => ({
	modelsFor: jest.fn(),
	providerIdsFor: jest.fn(),
	providerModels: jest.fn(),
	providers: jest.fn(),
	supportsSpeechToTextApiType: jest.fn(),
}));

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.tabs.channels': 'Channels',
		'settings.channels.notConfigured': 'Not configured',
		'settings.channels.configured': 'Configured',
		'settings.channels.configuration': 'Configuration',
		'settings.channels.configurationDescription':
			'Configure the models and tools used by messaging channels.',
		'settings.channels.getToken': 'Get token',
		'settings.channels.llmModel': 'Model',
		'settings.channels.llmModelDescription': 'Model used for channel replies.',
		'settings.channels.sttModel': 'Transcribe model',
		'settings.channels.sttModelDescription': 'Model used to transcribe channel audio.',
		'settings.channels.ttsModel': 'Voice model',
		'settings.channels.ttsModelDescription': 'Model used for channel speech.',
		'settings.channels.dmPolicy': 'Direct message access',
		'settings.channels.dmPolicies.allowlist': 'Allowlist',
		'settings.channels.dmPolicies.open': 'Open',
		'settings.channels.allowFromPlaceholder': 'User ID',
		'settings.channels.addAllowFrom': 'Add user',
		'settings.channels.groupAllowFromPlaceholder': 'Group ID',
		'settings.channels.addGroupAllowFrom': 'Add group',
		'settings.modelServices.tools': 'Tools',
		'settings.tabs.music': 'Music',
		'settings.tabs.image': 'Image',
		'settings.tabs.video': 'Video',
		'common.save': 'Save',
	};
	const t = (key: string, values?: { value?: string }): string => {
		if (key === 'settings.channels.removeAllowFrom') return `Remove user ${values?.value}`;
		if (key === 'settings.channels.removeGroupAllowFrom') return `Remove group ${values?.value}`;
		return translations[key] ?? key;
	};
	return { useTranslation: () => ({ t }) };
});

const channels = jest.fn();
const restartChannel = jest.fn().mockResolvedValue(undefined);
const listChannels = jest.fn();
const setChannel = jest.fn();
const getChannelsModelSelection = jest.fn();
const setChannelsModelSelection = jest.fn();
const getToolModel = jest.fn();
const setToolModel = jest.fn();
const provider = {
	id: 'openai',
	name: 'OpenAI',
	baseUrl: 'https://api.openai.com/v1',
};
const models = [
	{ id: 'first', name: 'First model' },
	{ id: 'second', name: 'Second model' },
];
let stored: ChannelCredentialSummary[];
let selections: Partial<Record<ChannelModelKind, { providerId: string; modelId: string }>>;

beforeEach(() => {
	stored = [];
	selections = {};
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { channels, restartChannel, getChannelsModelSelection, setChannelsModelSelection },
	});
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: { listChannels, setChannel },
	});
	Object.defineProperty(window, 'models', {
		configurable: true,
		value: {
			transcribe: {
				listProviders: jest.fn().mockResolvedValue([provider]),
				listModels: jest.fn().mockResolvedValue(models),
			},
		},
	});
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: { getToolModel, setToolModel },
	});
	jest.mocked(providers).mockReturnValue([provider]);
	jest.mocked(providerIdsFor).mockReturnValue(['openai']);
	jest.mocked(providerModels).mockReturnValue(models);
	jest.mocked(modelsFor).mockReturnValue([]);
	jest.mocked(supportsSpeechToTextApiType).mockReturnValue(true);
	getChannelsModelSelection.mockImplementation(
		async (kind: ChannelModelKind) => selections[kind] ?? {}
	);
	setChannelsModelSelection.mockImplementation(
		async (kind: ChannelModelKind, providerId: string, modelId: string) => {
			selections[kind] = { providerId, modelId };
		}
	);
	getToolModel.mockResolvedValue({
		providerId: 'openai',
		modelId: 'first',
		options: {},
	});
	setToolModel.mockImplementation(async (_kind, value) => value);
	channels.mockResolvedValue([
		{
			id: 'telegram/default',
			name: 'Telegram Bot API',
			type: 'bot',
			url: 'https://api.telegram.org',
			instructions: 'Message @BotFather, then paste the bot token here.',
			credentials: [{ key: 'apiKey', label: 'Bot token', type: 'password', required: true }],
			provider: {
				id: 'telegram/default',
				name: 'Telegram',
				baseUrl: 'https://api.telegram.org',
				apiKeyUrl: 'https://t.me/BotFather',
				iconDarkUrl: 'local-resource://telegram.svg',
				iconLightUrl: 'local-resource://telegram.svg',
			},
		},
	]);
	listChannels.mockImplementation(async () => stored);
	setChannel.mockImplementation(async ({ apiKey: _apiKey, ...value }) => {
		const { credentials: _credentials, ...metadata } = value;
		const summary = { ...metadata, configured: true };
		stored = [summary];
		return summary;
	});
});

it('lists channels with links to their detail pages', async () => {
	render(
		<MemoryRouter>
			<ChannelsPage />
		</MemoryRouter>
	);
	const link = await screen.findByRole('link', { name: /Telegram Bot API/ });
	expect(link).toHaveAttribute('href', '/settings/channels/telegram/default');
	expect(screen.queryByLabelText('Bot token')).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Model' })).not.toBeInTheDocument();
});

it('keeps the existing collapsible model controls', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ChannelsConfigurationPage />
		</MemoryRouter>
	);
	const modelButton = await screen.findByRole('button', { name: 'Model' });
	expect(modelButton).toHaveClass('min-w-40');
	expect(modelButton).toHaveAttribute('aria-haspopup', 'dialog');
	const modelItem = screen.getByRole('button', {
		name: /Model used for channel replies/,
	});
	expect(modelItem).toHaveAttribute('aria-expanded', 'false');
	await user.click(modelItem);
	expect(modelItem).toHaveAttribute('aria-expanded', 'true');
});

it('saves a trimmed token on Channels and clears the secret after persistence', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/channels/telegram/default']}>
			<Routes>
				<Route path="/settings/channels/:pluginId/:channelId" element={<ChannelDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);
	const token = await screen.findByLabelText('Bot token');
	expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
	await user.type(token, '  test-token  ');
	await user.click(screen.getByRole('button', { name: 'Save' }));
	await waitFor(() =>
		expect(setChannel).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'telegram/default', apiKey: 'test-token' })
		)
	);
	expect(token).toHaveValue('');
});

it('keeps the token editable when saving fails', async () => {
	setChannel.mockRejectedValue(new Error('Token could not be saved'));
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/channels/telegram/default']}>
			<Routes>
				<Route path="/settings/channels/:pluginId/:channelId" element={<ChannelDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);
	const token = await screen.findByLabelText('Bot token');
	await user.type(token, 'test-token');
	await user.click(screen.getByRole('button', { name: 'Save' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Token could not be saved');
	expect(token).toHaveValue('test-token');
	expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

it('loads stored access rules and persists DM policy and user/group changes without re-entering a token', async () => {
	stored = [
		{
			id: 'telegram/default',
			name: 'Telegram',
			configured: true,
			allowFrom: ['123'],
			groupAllowFrom: ['-100'],
			dmPolicy: 'allowlist',
		},
	];
	const user = userEvent.setup();
	const view = render(
		<MemoryRouter initialEntries={['/settings/channels/telegram/default']}>
			<Routes>
				<Route path="/settings/channels/:pluginId/:channelId" element={<ChannelDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);
	expect(await screen.findByText('123')).toBeInTheDocument();
	expect(screen.getByText('-100')).toBeInTheDocument();
	await user.click(screen.getByRole('combobox', { name: 'Direct message access' }));
	await user.click(await screen.findByRole('option', { name: 'Open' }));
	await waitFor(() =>
		expect(setChannel).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: 'telegram/default', apiKey: '', dmPolicy: 'open' })
		)
	);
	await user.type(screen.getByLabelText('User ID'), ' 456 ');
	await user.click(screen.getByRole('button', { name: 'Add user' }));
	await waitFor(() =>
		expect(setChannel).toHaveBeenLastCalledWith(
			expect.objectContaining({ apiKey: '', allowFrom: ['123', '456'] })
		)
	);
	await user.type(screen.getByLabelText('Group ID'), ' -200 ');
	await user.click(screen.getByRole('button', { name: 'Add group' }));
	await waitFor(() =>
		expect(setChannel).toHaveBeenLastCalledWith(
			expect.objectContaining({ apiKey: '', groupAllowFrom: ['-100', '-200'] })
		)
	);
	await user.click(screen.getByRole('button', { name: 'Remove user 123' }));
	await waitFor(() =>
		expect(setChannel).toHaveBeenLastCalledWith(
			expect.objectContaining({ apiKey: '', allowFrom: ['456'] })
		)
	);
	view.unmount();
	render(
		<MemoryRouter initialEntries={['/settings/channels/telegram/default']}>
			<Routes>
				<Route path="/settings/channels/:pluginId/:channelId" element={<ChannelDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);
	expect(await screen.findByText('456')).toBeInTheDocument();
	expect(screen.getByText('-200')).toBeInTheDocument();
	expect(screen.queryByText('123')).not.toBeInTheDocument();
	expect(screen.getByRole('combobox', { name: 'Direct message access' })).toHaveTextContent('Open');
	expect(screen.getByLabelText('Bot token')).toHaveValue('');
});

it.each([
	['llm', 'Model'],
	['stt', 'Transcribe model'],
	['tts', 'Voice model'],
] as const)('saves and reloads the %s model from the Channels page', async (kind, label) => {
	const user = userEvent.setup();
	const view = render(
		<MemoryRouter initialEntries={['/settings/channels/telegram/default']}>
			<Routes>
				<Route path="/settings/channels/:pluginId/:channelId" element={<ChannelDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);
	const button = await screen.findByRole('button', { name: label });
	await waitFor(() => expect(button).toBeEnabled());
	await user.click(button);
	await user.click(screen.getByRole('menuitemradio', { name: 'Second model OpenAI' }));
	await waitFor(() =>
		expect(setChannelsModelSelection).toHaveBeenCalledWith(kind, 'openai', 'second')
	);
	view.unmount();
	render(
		<MemoryRouter initialEntries={['/settings/channels/telegram/default']}>
			<Routes>
				<Route path="/settings/channels/:pluginId/:channelId" element={<ChannelDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);
	await waitFor(() =>
		expect(screen.getByRole('button', { name: label })).toHaveTextContent('Second model')
	);
});

it('keeps media-model changes scoped to the channels profile', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/channels/telegram/default']}>
			<Routes>
				<Route path="/settings/channels/:pluginId/:channelId" element={<ChannelDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);
	const button = await screen.findByRole('button', { name: 'Image' });
	await waitFor(() => expect(button).toBeEnabled());
	await user.click(button);
	await user.click(screen.getByRole('menuitemradio', { name: 'Second model OpenAI' }));
	await waitFor(() =>
		expect(setToolModel).toHaveBeenCalledWith(
			'image',
			expect.objectContaining({ providerId: 'openai', modelId: 'second' }),
			'channels'
		)
	);
});
