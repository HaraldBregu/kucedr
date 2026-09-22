import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatHistoryPage from '../../../src/renderer/src/pages/settings/pages/assistant/chathistory/Page';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

const agentApi = {
	listSessions: jest.fn(),
	deleteSession: jest.fn(),
	openSessionsFolder: jest.fn(),
};

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'agent', { configurable: true, value: agentApi });
	jest.spyOn(window, 'confirm').mockReturnValue(true);
	agentApi.listSessions.mockResolvedValue([
		{ id: 'session-1', title: 'First chat', createdAtMs: 1 },
		{ id: 'session-2', title: 'Second chat', createdAtMs: 2 },
	]);
	agentApi.deleteSession.mockResolvedValue(undefined);
	agentApi.openSessionsFolder.mockResolvedValue(undefined);
});

async function openActions(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	await user.click(await screen.findByRole('button', { name: 'common.moreOptions' }));
}

it('opens the chat history folder from the header actions', async () => {
	const user = userEvent.setup();
	render(<ChatHistoryPage />);

	await openActions(user);
	await user.click(screen.getByRole('menuitem', { name: 'settings.chatHistory.openFolder' }));

	expect(agentApi.openSessionsFolder).toHaveBeenCalledTimes(1);
});

it('loads every session type', async () => {
	render(<ChatHistoryPage />);

	await screen.findByText('First chat');
	expect(agentApi.listSessions).toHaveBeenCalledWith(true);
});

it('filters voice and task histories by their stored session category', async () => {
	agentApi.listSessions.mockResolvedValue([
		{ id: 'voice-session', title: 'Voice conversation', createdAtMs: 1, category: 'voice' },
		{ id: 'task-session', title: 'Task run', createdAtMs: 2, category: 'task' },
	]);
	const { rerender } = render(<ChatHistoryPage category="voice" />);

	await screen.findByText('Voice conversation');
	expect(screen.queryByText('Task run')).not.toBeInTheDocument();
	expect(screen.getByText('settings.modelServices.voiceHistoryTitle')).toBeInTheDocument();

	rerender(<ChatHistoryPage category="task" />);

	await screen.findByText('Task run');
	expect(screen.queryByText('Voice conversation')).not.toBeInTheDocument();
	expect(screen.getByText('settings.cron.history.pageTitle')).toBeInTheDocument();
});

it('confirms and deletes every stored chat from the header actions', async () => {
	const user = userEvent.setup();
	render(<ChatHistoryPage />);

	await screen.findByText('First chat');
	await openActions(user);
	await user.click(screen.getByRole('menuitem', { name: 'settings.chatHistory.delete' }));

	expect(window.confirm).toHaveBeenCalledWith('settings.chatHistory.confirmDelete');
	await waitFor(() => expect(agentApi.deleteSession).toHaveBeenCalledWith('session-1'));
	expect(agentApi.deleteSession).toHaveBeenCalledWith('session-2');
});
