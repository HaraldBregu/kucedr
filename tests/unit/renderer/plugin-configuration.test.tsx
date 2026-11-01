import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PluginPage from '../../../src/renderer/src/pages/settings/pages/plugins/Plugin';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useParams: () => ({ pluginId: 'openai' }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('saves a valid API key when editing ends without a save button', async () => {
	const saveSettings = jest.fn().mockResolvedValue(undefined);
	Object.defineProperty(window, 'plugins', { configurable: true, value: {
		list: jest.fn().mockResolvedValue([{ id: 'openai', name: 'OpenAI', enabled: true, builtIn: true, categories: [], settings: { inputSchema: { type: 'object', properties: { apiKey: { type: 'string', title: 'API key', format: 'password' } }, required: ['apiKey'] } } }]),
		getSettings: jest.fn().mockResolvedValue({}), saveSettings,
	} });
	Object.defineProperty(window, 'app', { configurable: true, value: { models: async () => [], mcps: async () => [], vectorDatabases: async () => [], storages: async () => [] } });
	Object.defineProperty(window, 'provider', { configurable: true, value: { getModelProviders: async () => [] } });
	Object.defineProperty(window, 'services', { configurable: true, value: { list: async () => [] } });
	Object.defineProperty(window, 'apps', { configurable: true, value: { list: async () => [] } });
	Object.defineProperty(window, 'mcp', { configurable: true, value: { registry: async () => ({ servers: [] }) } });
	Object.defineProperty(window, 'skills', { configurable: true, value: { list: async () => [] } });
	Object.defineProperty(window, 'scripts', { configurable: true, value: { list: async () => [] } });
	const user = userEvent.setup();
	render(<PluginPage />);
	const input = await screen.findByLabelText('API key');
	expect(input).toHaveAttribute('type', 'password');
	expect(screen.queryByRole('button', { name: 'common.save' })).not.toBeInTheDocument();
	await user.type(input, 'example-key');
	expect(saveSettings).not.toHaveBeenCalled();
	await user.tab();
	await waitFor(() => expect(saveSettings).toHaveBeenCalledWith('openai', { apiKey: 'example-key' }));
});
