import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskDetailsPage from '../../../src/renderer/src/pages/settings/pages/tasks/detail/Page';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.cron.detailsTitle': 'Task details',
		'settings.cron.enabled': 'Enabled',
		'settings.cron.disabled': 'Disabled',
		'settings.cron.detail.noDescription': 'No description',
		'settings.cron.detail.id': 'ID',
		'settings.cron.detail.schedule': 'Schedule',
		'settings.cron.detail.createdAt': 'Created',
		'settings.cron.detail.updatedAt': 'Updated',
		'settings.cron.detail.notScheduled': 'Not scheduled',
		'settings.cron.detail.promptInput': 'Prompt input',
		'settings.cron.history.title': 'Session History',
		'settings.cron.history.emptyTitle': 'No history yet',
		'settings.cron.history.emptyDescription':
			'Agent sessions created by this task will appear here.',
		'settings.cron.history.openFolder': 'Open session folder',
		'settings.cron.history.delete': 'Delete session history',
		'settings.cron.history.confirmDelete': 'Delete all session history?',
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
	prompt: 'Summarize today.',
	sessionIds: [],
	createdAt: '2026-09-10T08:00:00.000Z',
	updatedAt: '2026-09-10T08:00:00.000Z',
};

const list = jest.fn();
const history = jest.fn();
const setEnabled = jest.fn();
const openSessionFolder = jest.fn();
const deleteSession = jest.fn();

beforeEach(() => {
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: MouseEvent,
	});
	list.mockReset().mockResolvedValue([task]);
	history.mockReset().mockResolvedValue([
		{
			id: 'session-1',
			title: 'Nightly summary run',
			createdAtMs: Date.parse('2026-09-10T09:00:00.000Z'),
		},
	]);
	setEnabled.mockReset().mockResolvedValue({ ...task, enabled: false });
	openSessionFolder.mockReset().mockResolvedValue(undefined);
	deleteSession.mockReset().mockResolvedValue(undefined);
	Object.defineProperty(window, 'confirm', {
		configurable: true,
		value: jest.fn(() => true),
	});
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
		},
	});
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: { openSessionFolder, deleteSession },
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

	expect(await screen.findByText('Nightly summary run')).toBeInTheDocument();
	expect(screen.getByRole('switch', { name: 'Disable' })).toBeInTheDocument();

	await user.click(screen.getByRole('switch', { name: 'Disable' }));

	await waitFor(() => expect(setEnabled).toHaveBeenCalledWith('task-1', false));
	expect(history).toHaveBeenCalledTimes(1);
	expect(await screen.findByRole('switch', { name: 'Enable' })).toBeInTheDocument();
});

it('opens the session folder from a history entry', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/agent/tasks/task-1/detail']}>
			<Routes>
				<Route path="/settings/agent/tasks/:taskId/detail" element={<TaskDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: 'Open session folder' }));

	expect(openSessionFolder).toHaveBeenCalledWith('session-1');
});

it('deletes all session history from the section action', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/agent/tasks/task-1/detail']}>
			<Routes>
				<Route path="/settings/agent/tasks/:taskId/detail" element={<TaskDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: 'Delete session history' }));

	await waitFor(() => expect(deleteSession).toHaveBeenCalledWith('session-1'));
	expect(window.confirm).toHaveBeenCalledWith('Delete all session history?');
	expect(await screen.findByText('No history yet')).toBeInTheDocument();
});
