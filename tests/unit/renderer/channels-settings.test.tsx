import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChannelsPage from '../../../src/renderer/src/pages/settings/pages/channels/Page';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.tabs.channels': 'Channels',
		'settings.channels.description': 'Connect messaging channels.',
		'settings.channels.configured': 'Configured',
		'settings.channels.notConfigured': 'Not configured',
	};
	const t = (key: string): string => translations[key] ?? key;
	return { useTranslation: () => ({ t }) };
});

const channels = jest.fn();
const listChannels = jest.fn();

beforeEach(() => {
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { channels },
	});
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: { listChannels, list: jest.fn().mockResolvedValue([]), vaultStatus: jest.fn().mockResolvedValue({}) },
	});
	Object.defineProperty(window, 'search', { configurable: true, value: { getSettings: jest.fn().mockResolvedValue({ configured: {} }) } });
	Object.defineProperty(window, 'mcp', { configurable: true, value: { list: jest.fn().mockResolvedValue({}) } });
	channels.mockResolvedValue([
		{
			id: 'discord-bot',
			name: 'Discord Bot API',
			type: 'bot',
			url: 'https://discord.com/api',
			provider: {
				id: 'discord',
				name: 'Discord',
				baseUrl: 'https://discord.com/api',
				iconDarkUrl: 'local-resource://discord.svg',
				iconLightUrl: 'local-resource://discord.svg',
			},
		},
	]);
	listChannels.mockResolvedValue([
		{ id: 'discord', name: 'Discord', configured: true, baseUrl: 'https://discord.com/api' },
	]);
});

it('presents channels returned by the channel catalog IPC', async () => {
	render(
		<MemoryRouter>
			<ChannelsPage />
		</MemoryRouter>
	);

	expect(await screen.findByText('Discord')).toBeInTheDocument();
	expect(screen.getByText('Discord Bot API')).toBeInTheDocument();
	expect(screen.getByText('Configured')).toBeInTheDocument();
	expect(channels).toHaveBeenCalledTimes(1);
});
