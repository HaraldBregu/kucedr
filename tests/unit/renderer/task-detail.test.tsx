import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskDetailsPage from '../../../src/renderer/src/pages/settings/pages/tasks/detail/Page';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.cron.detailsTitle': 'Task details',
		'settings.cron.enabled': 'Enabled',
		'settings.cron.disabled': 'Disabled',
		'settings.cron.detail.agent': 'Agent prompt',
		'settings.cron.detail.debug': 'Debug message',
		'settings.cron.detail.noDescription': 'No description',
		'settings.cron.detail.id': 'ID',
		'settings.cron.detail.schedule': 'Schedule',
		'settings.cron.detail.actionType': 'Action type',
		'settings.cron.detail.effort': 'Reasoning effort',
		'settings.cron.detail.createdAt': 'Created',
		'settings.cron.detail.updatedAt': 'Updated',
		'settings.cron.detail.notScheduled': 'Not scheduled',
		'settings.cron.detail.promptInput': 'Prompt input',
		'settings.cron.detail.promptInputDescription': 'Prompt description',
		'settings.cron.detail.capabilities': 'Run capabilities',
		'settings.cron.detail.capabilitiesDescription': 'Capabilities description',
		'settings.cron.detail.toolsPlaceholder': 'All tools',
		'settings.cron.detail.saveCapabilities': 'Save capabilities',
		'settings.cron.history.title': 'History',
		'settings.cron.history.description': 'Recent activity',
		'settings.cron.history.emptyTitle': 'No history yet',
		'settings.cron.history.emptyDescription': 'Task activity will appear here.',
		'settings.cron.actions.run': 'Run now',
		'settings.cron.actions.running': 'Running...',
		'settings.cron.actions.remove': 'Delete',
		'settings.cron.actions.removing': 'Deleting...',
		'settings.cron.actions.disable': 'Disable',
		'settings.cron.actions.enable': 'Enable',
		'settings.cron.actions.updating': 'Updating...',
	};
	return { useTranslation: () => ({ t: (key: string): string => translations[key] ?? key }) };
});

const task = {
	id: 'task-1',
	name: 'Nightly summary',
	description: 'Summarize work',
	cronExpression: '0 9 * * *',
	enabled: true,
	action: { type: 'agent' as const, prompt: 'Summarize today.', effort: 'low' as const },
	sessionIds: [],
	createdAt: '2026-09-10T08:00:00.000Z',
	updatedAt: '2026-09-10T08:00:00.000Z',
};

const list = jest.fn();
const history = jest.fn();
const setEnabled = jest.fn();

beforeEach(() => {
	list.mockReset().mockResolvedValue([task]);
	history.mockReset().mockResolvedValue([
		{
			eventId: 'event-1',
			scheduleId: task.id,
			type: 'schedule.completed',
			timestamp: '2026-09-10T09:00:00.000Z',
			message: 'Scheduled agent run completed.',
		},
	]);
	setEnabled.mockReset().mockResolvedValue({ ...task, enabled: false });
	Object.defineProperty(window, 'tasks', {
		configurable: true,
		value: {
			list,
			history,
			setEnabled,
			runNow: jest.fn(),
			delete: jest.fn(),
			getRuntime: jest.fn(),
			setRuntime: jest.fn(),
			configureCapabilities: jest.fn(),
		},
	});
});

it('shows task history and toggles the schedule state', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/agent/tasks/task-1/detail']}>
			<Routes>
				<Route path="/settings/agent/tasks/:taskId/detail" element={<TaskDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);

	expect(await screen.findByText('Scheduled agent run completed.')).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();

	await user.click(screen.getByRole('button', { name: 'Disable' }));

	await waitFor(() => expect(setEnabled).toHaveBeenCalledWith('task-1', false));
	expect(history).toHaveBeenCalledTimes(2);
	expect(await screen.findByRole('button', { name: 'Enable' })).toBeInTheDocument();
});
