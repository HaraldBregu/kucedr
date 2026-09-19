import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoryPage from '../../../src/renderer/src/pages/settings/pages/memory/Page';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../../src/renderer/src/lib/providers', () => ({
	modelsFor: () => [],
	providerIdsFor: () => [],
	providerModels: () => [],
	providers: () => [],
}));
jest.mock('../../../src/renderer/src/pages/settings/components/model-configuration', () => ({
	ModelProviderConfiguration: () => null,
}));

const config = {
	enabled: true,
	providerId: 'openai',
	modelId: 'model',
	modelOptions: {},
	memoryType: 'both',
	scheduleEnabled: true,
	cronExpression: '*/15 * * * *',
	timezone: 'Europe/Rome',
};
const api = {
	getConfig: jest.fn(),
	configure: jest.fn(),
	status: jest.fn(),
	list: jest.fn(),
	read: jest.fn(),
	edit: jest.fn(),
	forget: jest.fn(),
	clear: jest.fn(),
	refresh: jest.fn(),
};
beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'memory', { configurable: true, value: api });
	api.getConfig.mockResolvedValue(config);
	api.status.mockResolvedValue({ running: false, lastSuccess: null, error: null, pending: 0 });
	api.list.mockResolvedValue([{ id: 'fact-1', fact: 'Prefers tea' }]);
	api.read.mockResolvedValue('# Notes\nPrefers tea');
	api.configure.mockImplementation(async (value) => value);
	api.edit.mockResolvedValue(undefined);
});

it('saves independent memory configuration through the memory API', async () => {
	const user = userEvent.setup();
	render(<MemoryPage />);
	await user.click(await screen.findByRole('switch', { name: 'settings.memory.enabled' }));
	await user.click(screen.getByRole('button', { name: 'settings.memory.saveSettings' }));
	await waitFor(() => expect(api.configure).toHaveBeenCalledWith({ ...config, enabled: false }));
});

it('retains unsaved notes after a failed edit and prevents destructive reloads', async () => {
	api.edit.mockRejectedValueOnce(new Error('Disk is full'));
	const user = userEvent.setup();
	render(<MemoryPage />);
	const editor = await screen.findByRole('textbox', { name: 'settings.memory.content' });
	await user.type(editor, '\nManual note');
	expect(screen.getByRole('button', { name: 'settings.memory.refresh' })).toBeDisabled();
	expect(screen.getByRole('button', { name: 'settings.memory.forget' })).toBeDisabled();
	await user.click(screen.getByRole('button', { name: 'settings.memory.saveContent' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Disk is full');
	expect(editor).toHaveValue('# Notes\nPrefers tea\nManual note');
});

it('forgets an entry using its stable identifier', async () => {
	const user = userEvent.setup();
	render(<MemoryPage />);
	await user.click(await screen.findByRole('button', { name: 'settings.memory.forget' }));
	await waitFor(() => expect(api.forget).toHaveBeenCalledWith('fact-1'));
});
