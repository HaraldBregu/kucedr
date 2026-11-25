import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MemoryPage from '../../../src/renderer/src/pages/settings/pages/memory/Page';

const renderPage = (): ReturnType<typeof render> =>
	render(
		<MemoryRouter>
			<MemoryPage />
		</MemoryRouter>
	);

const mockProvider = { id: 'openai', name: 'OpenAI', baseUrl: 'https://openai.example' };
const mockModel = {
	id: 'model',
	name: 'GPT',
	type: 'llm',
	provider: mockProvider,
	metadata: {
		documentationStatus: 'verified',
		documentationUrl: '',
		inputs: {
			creativity: { type: 'number', title: 'Creativity', default: 0.7 },
		},
	},
};

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../../src/renderer/src/lib/providers', () => ({
	modelsFor: (capability: string) => (capability === 'llm' ? [mockModel] : []),
	providerIdsFor: (capability: string) => (capability === 'llm' ? [mockProvider.id] : []),
	providerModels: (providerId: string, capability: string) =>
		providerId === mockProvider.id && capability === 'llm' ? [mockModel] : [],
	providers: () => [mockProvider],
}));

const config = {
	enabled: true,
	providerId: 'openai',
	modelId: 'model',
	modelOptions: {},
	memoryType: 'both',
};
const api = {
	getConfig: jest.fn(),
	configure: jest.fn(),
	status: jest.fn(),
	list: jest.fn(),
	read: jest.fn(),
	edit: jest.fn(),
	update: jest.fn(),
	forget: jest.fn(),
	clear: jest.fn(),
	refresh: jest.fn(),
};
beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'memory', { configurable: true, value: api });
	Object.defineProperty(window, 'dataControls', {
		configurable: true,
		value: { listScopes: jest.fn().mockResolvedValue([]) },
	});
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: { listSessions: jest.fn().mockResolvedValue([]) },
	});
	api.getConfig.mockResolvedValue(config);
	api.status.mockResolvedValue({ running: false, lastSuccess: null, error: null, pending: 0 });
	api.list.mockResolvedValue([{ id: 'fact-1', fact: 'Prefers tea' }]);
	api.read.mockResolvedValue('# Notes\nPrefers tea');
	api.configure.mockImplementation(async (value) => value);
	api.edit.mockResolvedValue(undefined);
});

it('shows the selected model and reveals its options when expanded', async () => {
	const user = userEvent.setup();
	renderPage();
	const modelSelect = await screen.findByRole('button', { name: 'settings.memory.model' });
	const heading = screen.getByRole('heading', { name: 'settings.memory.title' });
	expect(modelSelect).toHaveTextContent('GPT');
	expect(screen.queryByRole('spinbutton', { name: 'Creativity' })).not.toBeInTheDocument();
	await user.click(
		screen.getByRole('button', { name: /settings.memory.model settings.memory.modelDescription/ })
	);
	expect(screen.getByText('Advanced properties')).toBeInTheDocument();
	expect(screen.getByRole('spinbutton', { name: 'Creativity' })).toHaveValue(0.7);
	expect(heading.closest('header')?.querySelector('svg')).toBeNull();
	expect(
		screen.queryByRole('button', { name: 'settings.memory.saveSettings' })
	).not.toBeInTheDocument();
});

it('saves independent memory configuration automatically', async () => {
	const user = userEvent.setup();
	renderPage();
	await user.click(await screen.findByRole('switch', { name: 'settings.memory.enabled' }));
	await waitFor(() => expect(api.configure).toHaveBeenCalledWith({ ...config, enabled: false }));
});

it('does not show scheduling controls', async () => {
	renderPage();
	await screen.findByRole('button', { name: 'settings.memory.model' });
	expect(screen.queryByText('settings.memory.schedule')).not.toBeInTheDocument();
	expect(screen.queryByText('settings.memory.frequency')).not.toBeInTheDocument();
	expect(screen.queryByText('settings.memory.customCron')).not.toBeInTheDocument();
	expect(screen.queryByText('settings.memory.timezone')).not.toBeInTheDocument();
});

it('lists remembered facts without showing the raw memory file', async () => {
	renderPage();
	expect(await screen.findByText('Prefers tea')).toBeInTheDocument();
	expect(api.read).not.toHaveBeenCalled();
	expect(screen.queryByText('# Notes')).not.toBeInTheDocument();
});
