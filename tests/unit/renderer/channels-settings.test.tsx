import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChannelsPage from '../../../src/renderer/src/pages/settings/pages/channels/Page';
import ChannelDetailPage from '../../../src/renderer/src/pages/settings/pages/channels/detail/Page';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.tabs.channels': 'Channels',
		'settings.channels.configured': 'Configured',
		'settings.channels.notConfigured': 'Not configured',
		'settings.channels.bot': 'Bot token',
		'settings.channels.connect': 'Connect',
		'settings.channels.editToken': 'Edit token',
		'settings.channels.configuration': 'Configuration',
		'settings.channels.getToken': 'Get token',
		'common.save': 'Save',
		'common.cancel': 'Cancel',
	};
	const t = (key: string, values?: { name?: string }): string => {
		if (key === 'settings.integrations.add') return `Add ${values?.name}`;
		if (key === 'settings.integrations.options') return `Options for ${values?.name}`;
		return translations[key] ?? key;
	};
	return { useTranslation: () => ({ t }) };
});

const channels = jest.fn();
const listChannels = jest.fn();
const getChannel = jest.fn();
const setChannel = jest.fn();

beforeEach(() => {
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: {
			channels,
			getChannelsModelSelection: jest.fn().mockResolvedValue({}),
		},
	});
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: { listChannels, getChannel, setChannel },
	});
	Object.defineProperty(window, 'models', {
		configurable: true,
		value: {
			transcribe: {
				listProviders: jest.fn().mockResolvedValue([]),
			},
		},
	});
	channels.mockResolvedValue([
		{
			id: 'telegram-bot',
			name: 'Telegram Bot API',
			type: 'bot',
			url: 'https://api.telegram.org',
			instructions:
				'Open Telegram, message @BotFather, send /newbot and follow the prompts, then paste the bot token here.',
			credentials: [{ key: 'apiKey', label: 'Bot token', type: 'password', required: true }],
			provider: {
				id: 'telegram',
				name: 'Telegram',
				baseUrl: 'https://api.telegram.org',
				iconDarkUrl: 'local-resource://telegram.svg',
				iconLightUrl: 'local-resource://telegram.svg',
			},
		},
	]);
	listChannels.mockResolvedValue([]);
	getChannel.mockResolvedValue(undefined);
	setChannel.mockResolvedValue({ id: 'telegram', configured: true });
});

it('shows a Plugins-style Telegram row and opens its detailed configuration', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/channels']}>
			<Routes>
				<Route path="/settings/channels" element={<ChannelsPage />} />
				<Route path="/settings/channels/channelDetail/telegram" element={<p>Telegram details</p>} />
			</Routes>
		</MemoryRouter>
	);
	expect(await screen.findByText('Telegram Bot API')).toBeInTheDocument();
	expect(screen.getByText('Telegram')).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Add Telegram Bot API' })).toBeInTheDocument();
	await user.click(screen.getByRole('link', { name: /Telegram Bot API Telegram/ }));
	expect(screen.getByText('Telegram details')).toBeInTheDocument();
});

it('renders manifest credentials on the detail page and saves a trimmed token', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/channels/channelDetail/telegram']}>
			<ChannelDetailPage />
		</MemoryRouter>
	);
	expect(
		await screen.findByText(
			'Open Telegram, message @BotFather, send /newbot and follow the prompts, then paste the bot token here.'
		)
	).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
	await user.type(screen.getByLabelText('Bot token'), '  test-token  ');
	await user.click(screen.getByRole('button', { name: 'Save' }));
	await waitFor(() =>
		expect(setChannel).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'telegram', apiKey: 'test-token' })
		)
	);
	expect(screen.getByLabelText('Bot token')).toHaveValue('');
});

it('keeps the token editable when saving fails', async () => {
	setChannel.mockRejectedValue(new Error('Token could not be saved'));
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/channels/channelDetail/telegram']}>
			<ChannelDetailPage />
		</MemoryRouter>
	);
	await user.type(await screen.findByLabelText('Bot token'), 'test-token');
	await user.click(screen.getByRole('button', { name: 'Save' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Token could not be saved');
	expect(screen.getByLabelText('Bot token')).toHaveValue('test-token');
	expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

it('opens configured credentials from the Plugins-style options menu', async () => {
	listChannels.mockResolvedValue([{ id: 'telegram', configured: true }]);
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/channels']}>
			<Routes>
				<Route path="/settings/channels" element={<ChannelsPage />} />
				<Route path="/settings/channels/channelDetail/telegram" element={<p>Telegram details</p>} />
			</Routes>
		</MemoryRouter>
	);
	await user.click(await screen.findByRole('button', { name: 'Options for Telegram Bot API' }));
	await user.click(screen.getByRole('menuitem', { name: 'Edit token' }));
	expect(screen.getByText('Telegram details')).toBeInTheDocument();
});
