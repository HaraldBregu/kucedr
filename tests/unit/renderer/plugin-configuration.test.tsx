import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PluginPage from '../../../src/renderer/src/pages/settings/pages/plugins/Plugin';

jest.mock('react-router-dom', () => ({
	useNavigate: () => jest.fn(),
	useParams: () => ({ pluginId: 'openai' }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('saves, edits, cancels and resets the API key using model controls', async () => {
	const saveSettings = jest.fn().mockResolvedValue(undefined);
	const openExternalUrl = jest.fn().mockResolvedValue(undefined);
	Object.defineProperty(window, 'plugins', {
		configurable: true,
		value: {
			list: jest.fn().mockResolvedValue([
				{
					id: 'openai',
					name: 'OpenAI',
					website: 'https://openai.com',
					enabled: true,
					builtIn: true,
					categories: [],
					settings: {
						inputSchema: {
							type: 'object',
							properties: { apiKey: { type: 'string', title: 'API key', format: 'password' } },
							required: ['apiKey'],
						},
					},
				},
			]),
			getSettings: jest.fn().mockResolvedValue({}),
			saveSettings,
		},
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: {
			openExternalUrl,
			models: async () => [],
			mcps: async () => [],
			vectorDatabases: async () => [],
			storages: async () => [],
		},
	});
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: { getModelProviders: async () => [] },
	});
	Object.defineProperty(window, 'services', {
		configurable: true,
		value: { list: async () => [] },
	});
	Object.defineProperty(window, 'apps', { configurable: true, value: { list: async () => [] } });
	Object.defineProperty(window, 'mcp', {
		configurable: true,
		value: { registry: async () => ({ servers: [] }) },
	});
	Object.defineProperty(window, 'skills', { configurable: true, value: { list: async () => [] } });
	Object.defineProperty(window, 'scripts', { configurable: true, value: { list: async () => [] } });
	const user = userEvent.setup();
	render(<PluginPage />);
	await user.click(await screen.findByRole('link', { name: 'settings.integrations.plugin.website' }));
	expect(openExternalUrl).toHaveBeenCalledWith('https://openai.com/');
	await user.click(await screen.findByRole('button', { name: 'Connect' }));
	const input = screen.getByLabelText('API key');
	expect(input).toHaveAttribute('type', 'password');
	await user.type(input, 'example-key');
	await user.click(screen.getByRole('button', { name: 'common.cancel' }));
	expect(saveSettings).not.toHaveBeenCalled();
	await user.click(screen.getByRole('button', { name: 'Connect' }));
	await user.type(screen.getByLabelText('API key'), 'example-key');
	await user.click(screen.getByRole('button', { name: 'common.save' }));
	await waitFor(() =>
		expect(saveSettings).toHaveBeenCalledWith('openai', { apiKey: 'example-key' })
	);
	await user.click(await screen.findByRole('button', { name: 'Options for API key' }));
	await user.click(await screen.findByRole('menuitem', { name: 'Edit API key' }));
	await user.type(screen.getByLabelText('API key'), 'replacement');
	await user.click(screen.getByRole('button', { name: 'common.cancel' }));
	expect(saveSettings).toHaveBeenCalledTimes(1);
	await user.click(screen.getByRole('button', { name: 'Options for API key' }));
	await user.click(await screen.findByRole('menuitem', { name: 'Reset' }));
	await waitFor(() => expect(saveSettings).toHaveBeenLastCalledWith('openai', {}));
	expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
});
