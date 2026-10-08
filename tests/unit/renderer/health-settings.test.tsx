import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

it('automatically saves enabled changes without writing HEALTH.md', async () => {
	const user = await openConfiguration();
	await user.click(screen.getByRole('switch', { name: 'settings.health.fields.enabled' }));
	await waitFor(() => expect(api.healthSaveSettings).toHaveBeenCalledWith({ enabled: false }));
	expect(api.healthSaveData).not.toHaveBeenCalled();
});

it('saves a cron draft on blur without a Save button', async () => {
	await openConfiguration();
	const field = screen.getByRole('textbox', { name: 'settings.health.fields.cronExpression' });
	fireEvent.change(field, { target: { value: ' 0 9 * * 1-5 ' } });
	expect(api.healthSaveSettings).not.toHaveBeenCalled();
	fireEvent.blur(field);
	await waitFor(() =>
		expect(api.healthSaveSettings).toHaveBeenCalledWith({ cronExpression: '0 9 * * 1-5' })
	);
	await waitFor(() => expect(field).toHaveValue('0 9 * * 1-5'));
});

it('shows invalid cron errors while preserving the draft for correction', async () => {
	api.healthSaveSettings.mockRejectedValue(
		new Error('Health schedule must be a valid cron expression.')
	);
	await openConfiguration();
	const field = screen.getByRole('textbox', { name: 'settings.health.fields.cronExpression' });
	fireEvent.change(field, { target: { value: 'invalid' } });
	fireEvent.blur(field);
	await screen.findByText('Health schedule must be a valid cron expression.');
	expect(field).toHaveValue('invalid');
});
