import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChannelsPage from '../../../src/renderer/src/pages/settings/pages/channels/Page';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.tabs.channels': 'Channels',
		'settings.channels.configured': 'Configured',
		'settings.channels.notConfigured': 'Not configured',
		'settings.channels.bot': 'Bot token',
		'settings.channels.connect': 'Connect',
		'settings.channels.editToken': 'Edit token',
		'settings.channels.configuration': 'Configuration',
		'common.save': 'Save',
		'common.cancel': 'Cancel',
	};
	const t = (key: string): string => translations[key] ?? key;
	return { useTranslation: () => ({ t }) };
});

const channels = jest.fn();
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
		value: { getChannel, setChannel },
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
			provider: {
				id: 'telegram',
				name: 'Telegram',
				baseUrl: 'https://api.telegram.org',
				iconDarkUrl: 'local-resource://telegram.svg',
				iconLightUrl: 'local-resource://telegram.svg',
			},
		},
	]);
	getChannel.mockResolvedValue({ id: 'telegram', configured: false });
	setChannel.mockResolvedValue({ id: 'telegram', configured: true });
});

it('shows a single Telegram connection and opens its detailed configuration', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/channels']}>
			<Routes>
				<Route path="/settings/channels" element={<ChannelsPage />} />
				<Route path="/settings/channels/channelDetail/telegram" element={<p>Telegram details</p>} />
			</Routes>
		</MemoryRouter>
	);
	expect(await screen.findAllByRole('heading', { name: 'Telegram', exact: true })).toHaveLength(1);
	expect(screen.getByText('Telegram Bot API')).toBeInTheDocument();
	expect(screen.getByText('Not configured')).toBeInTheDocument();
	expect(getChannel).toHaveBeenCalledWith('telegram');
	await user.click(screen.getByRole('link', { name: 'Configuration' }));
	expect(screen.getByText('Telegram details')).toBeInTheDocument();
});

it('saves a trimmed Telegram token and clears it after success', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ChannelsPage />
		</MemoryRouter>
	);
	await user.click(await screen.findByRole('button', { name: 'Connect' }));
	expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
	await user.type(screen.getByLabelText('Bot token'), '  test-token  ');
	await user.click(screen.getByRole('button', { name: 'Save' }));
	await waitFor(() =>
		expect(setChannel).toHaveBeenCalledWith({ id: 'telegram', apiKey: 'test-token' })
	);
	expect(await screen.findByText('Configured')).toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'Edit token' }));
	expect(screen.getByLabelText('Bot token')).toHaveValue('');
});

it('keeps the token editable when saving fails', async () => {
	setChannel.mockRejectedValue(new Error('Token could not be saved'));
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ChannelsPage />
		</MemoryRouter>
	);
	await user.click(await screen.findByRole('button', { name: 'Connect' }));
	await user.type(screen.getByLabelText('Bot token'), 'test-token');
	await user.click(screen.getByRole('button', { name: 'Save' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Token could not be saved');
	expect(screen.getByLabelText('Bot token')).toHaveValue('test-token');
	expect(screen.getByText('Not configured')).toBeInTheDocument();
});
