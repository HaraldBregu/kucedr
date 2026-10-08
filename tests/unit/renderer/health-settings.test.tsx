import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HealthPage from '../../../src/renderer/src/pages/settings/pages/tasks/health/Page';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../../src/renderer/src/lib/providers', () => ({
	providerIdsFor: () => [],
	providerModels: () => [],
	providers: () => [],
}));

const settings = {
	enabled: true,
	cronExpression: '*/30 * * * *',
	every: '30m',
	target: 'last',
	directPolicy: 'allow',
	modelOptions: {},
};
const api = {
	healthGetSettings: jest.fn(),
	healthSaveSettings: jest.fn(),
	healthGetData: jest.fn(),
	healthSaveData: jest.fn(),
};

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'agent', { configurable: true, value: api });
	api.healthGetSettings.mockResolvedValue(settings);
	api.healthSaveSettings.mockImplementation(async (patch) => ({ ...settings, ...patch }));
});

async function openConfiguration() {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<HealthPage />
		</MemoryRouter>
	);
	await user.click(
		await screen.findByRole('button', {
			name: /settings.modelServices.llmModel settings.modelServices.modelDescription/,
		})
	);
	return user;
}

it('hides HEALTH.md, checklist, chat permissions, and save buttons', async () => {
	await openConfiguration();
	expect(screen.queryByText('settings.health.checklistTitle')).not.toBeInTheDocument();
	expect(screen.queryByText('settings.health.checklistDescription')).not.toBeInTheDocument();
	expect(screen.queryByRole('link', { name: /settings.tabs.permissions/ })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'common.save' })).not.toBeInTheDocument();
	expect(screen.getByRole('link', { name: /settings.modelServices.tools/ })).toHaveAttribute(
		'href',
		'/settings/health/tools'
	);
	expect(api.healthGetData).not.toHaveBeenCalled();
});

it('automatically saves off without writing HEALTH.md', async () => {
	const user = await openConfiguration();
	await user.click(screen.getByRole('combobox', { name: 'settings.health.fields.every' }));
	await user.click(screen.getByRole('option', { name: 'settings.storage.autoSync.off' }));
	await waitFor(() => expect(api.healthSaveSettings).toHaveBeenCalledWith({ enabled: false }));
	expect(api.healthSaveData).not.toHaveBeenCalled();
});

it('automatically saves selected schedules with the matching cron expression', async () => {
	const user = await openConfiguration();
	await user.click(screen.getByRole('combobox', { name: 'settings.health.fields.every' }));
	await user.click(screen.getByRole('option', { name: 'settings.storage.autoSync.every1d' }));
	await waitFor(() =>
		expect(api.healthSaveSettings).toHaveBeenCalledWith({
			enabled: true,
			cronExpression: '0 3 * * *',
		})
	);
});

it('shows save errors and restores the previously saved schedule', async () => {
	api.healthSaveSettings.mockRejectedValue(new Error('Could not save schedule.'));
	const user = await openConfiguration();
	await user.click(screen.getByRole('combobox', { name: 'settings.health.fields.every' }));
	await user.click(screen.getByRole('option', { name: 'settings.storage.autoSync.every1d' }));
	await screen.findByText('Could not save schedule.');
	expect(screen.getByRole('combobox', { name: 'settings.health.fields.every' })).toHaveTextContent(
		'settings.storage.autoSync.every30m'
	);
});

it('shows a separate scheduling select while model settings are collapsed', async () => {
	render(
		<MemoryRouter>
			<HealthPage />
		</MemoryRouter>
	);
	await screen.findByRole('heading', { name: 'settings.health.fields.cronScheduling' });
	expect(
		screen.getByRole('combobox', { name: 'settings.health.fields.every' })
	).toBeInTheDocument();
	expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
