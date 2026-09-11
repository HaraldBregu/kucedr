import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
	PageContainer,
	SPLIT_ITEM_CLASS,
	Split,
} from '../../../src/renderer/src/components/app/base/page';
import { ChatSessionContext } from '../../../src/renderer/src/contexts/chat-session';
import { HomeSidebar } from '../../../src/renderer/src/pages/home/Sidebar';
import type { AuthState } from '../../../src/shared/auth_types';

const mockUseAuth = jest.fn();

jest.mock('../../../src/renderer/src/contexts/AuthContext', () => ({
	useAuth: () => mockUseAuth(),
}));

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

const listSessions = jest.fn();
const renameSession = jest.fn();
const deleteSession = jest.fn();
const showContextMenu = jest.fn();

beforeEach(() => {
	mockUseAuth.mockReturnValue({
		state: { status: 'signedOut', persistence: 'encrypted' },
		localOnly: false,
		skipSignIn: jest.fn(),
		requireSignIn: jest.fn(),
	});
	window.localStorage.clear();
	document.documentElement.style.removeProperty('--app-sidebar-width');
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: MouseEvent,
	});
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: jest.fn((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: jest.fn(),
			removeListener: jest.fn(),
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			dispatchEvent: jest.fn(),
		})),
	});
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: { listSessions, renameSession, deleteSession },
	});
	Object.defineProperty(window, 'win', {
		configurable: true,
		value: { showContextMenu },
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: {
			openExternalUrl: jest.fn().mockResolvedValue(undefined),
		},
	});
});

it('loads chat history, marks the latest default session, and switches sessions', async () => {
	const user = userEvent.setup();
	const setSessionId = jest.fn();
	listSessions.mockResolvedValue([
		{ id: 'session-latest', title: 'Latest chat', createdAtMs: 2, runStatus: 'running' },
		{ id: 'session-older', title: 'Older chat', createdAtMs: 1 },
	]);

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'home', setSessionId }}>
				<PageContainer>
					<HomeSidebar refreshKey="initial" />
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	const navigation = await screen.findByRole('navigation', {
		name: 'settings.chatHistory.title',
	});
	const latest = within(navigation).getByRole('button', { name: 'Latest chat' });
	const older = within(navigation).getByRole('button', { name: 'Older chat' });
	expect(latest).toHaveAttribute('aria-current', 'page');
	expect(latest).toHaveAttribute('data-run-status', 'running');
	expect(latest.style.animation).toBe('');
	const latestTitle = within(latest).getByText('Latest chat');
	expect(latestTitle).toHaveClass('truncate', 'bg-clip-text', 'text-transparent');
	expect(latestTitle).toHaveStyle({
		animation: 'text-shimmer var(--text-shimmer-duration) linear infinite',
	});

	await user.click(older);
	expect(setSessionId).toHaveBeenCalledWith('session-older');
	expect(screen.getByRole('link', { name: 'settings.title' })).toHaveAttribute(
		'href',
		'/settings/general'
	);
	expect(screen.getByText('settings.title')).toBeInTheDocument();
	expect(
		screen.getByRole('link', { name: 'settings.title' }).querySelector('.lucide-settings-2')
	).toBeInTheDocument();
	expect(
		screen.queryByRole('button', { name: 'settings.modelServices.voiceName' })
	).not.toBeInTheDocument();
});

it.each<[AuthState]>([
	[
		{
			status: 'signedIn',
			persistence: 'encrypted',
			user: { id: 'user-1', email: 'ada@example.com', displayName: 'Ada Lovelace' },
		},
	],
	[
		{
			status: 'signedIn',
			persistence: 'encrypted',
			user: { id: 'user-2', email: 'grace@example.com' },
		},
	],
])('shows the settings label for authenticated users', async (state) => {
	listSessions.mockResolvedValue([]);
	mockUseAuth.mockReturnValue({
		state,
		localOnly: false,
		skipSignIn: jest.fn(),
		requireSignIn: jest.fn(),
	});

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'home', setSessionId: jest.fn() }}>
				<PageContainer>
					<HomeSidebar refreshKey="initial" />
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	const accountLink = screen.getByRole('link', { name: 'settings.title' });
	expect(accountLink).toHaveAttribute('href', '/settings/general');
	expect(within(accountLink).getByText('settings.title')).toBeInTheDocument();
	expect(accountLink.querySelector('.lucide-user')).toBeInTheDocument();
	await screen.findByText('settings.chatHistory.empty');
});

it('renames a chat from its context menu without item action buttons', async () => {
	const user = userEvent.setup();
	listSessions.mockResolvedValue([{ id: 'session-latest', title: 'Latest chat', createdAtMs: 2 }]);
	showContextMenu.mockResolvedValue('rename');
	renameSession.mockResolvedValue(undefined);

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'session-latest', setSessionId: jest.fn() }}>
				<PageContainer>
					<HomeSidebar refreshKey="initial" />
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	const chat = await screen.findByRole('button', { name: 'Latest chat' });
	expect(screen.queryByRole('button', { name: 'Rename Latest chat' })).not.toBeInTheDocument();
	fireEvent.contextMenu(chat);
	expect(showContextMenu).toHaveBeenCalledWith([
		{ id: 'rename', label: 'common.rename' },
		{ id: 'delete', label: 'common.delete' },
	]);
	const input = await screen.findByRole('textbox', { name: 'Rename Latest chat' });
	await user.clear(input);
	await user.type(input, 'Named chat{Enter}');
	await waitFor(() => expect(renameSession).toHaveBeenCalledWith('session-latest', 'Named chat'));
});

it('requires confirmation before permanently deleting a chat', async () => {
	listSessions.mockResolvedValue([{ id: 'session-latest', title: 'Latest chat', createdAtMs: 2 }]);
	showContextMenu.mockResolvedValue('delete');
	deleteSession.mockResolvedValue(undefined);
	const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'session-latest', setSessionId: jest.fn() }}>
				<PageContainer>
					<HomeSidebar refreshKey="initial" />
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	const chat = await screen.findByRole('button', { name: 'Latest chat' });
	fireEvent.contextMenu(chat);
	await waitFor(() => expect(confirm).toHaveBeenCalled());
	expect(deleteSession).not.toHaveBeenCalled();

	confirm.mockReturnValue(true);
	fireEvent.contextMenu(chat);
	await waitFor(() => expect(deleteSession).toHaveBeenCalledWith('session-latest'));
	await waitFor(() => expect(screen.queryByRole('button', { name: 'Latest chat' })).toBeNull());
});

it('starts a new chat from the sidebar', async () => {
	const user = userEvent.setup();
	const setSessionId = jest.fn();
	listSessions.mockResolvedValue([]);
	Object.defineProperty(globalThis.crypto, 'randomUUID', {
		configurable: true,
		value: jest.fn(() => '00000000-0000-4000-8000-000000000001'),
	});

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'home', setSessionId }}>
				<PageContainer>
					<HomeSidebar refreshKey="initial" />
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	const newChat = screen.getByRole('button', { name: 'titleBar.newChat' });
	expect(newChat).toHaveAttribute('class', SPLIT_ITEM_CLASS);
	await user.click(newChat);
	expect(setSessionId).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
});

it('shows an empty state when there is no chat history', async () => {
	listSessions.mockResolvedValue([]);

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'home', setSessionId: jest.fn() }}>
				<PageContainer>
					<HomeSidebar refreshKey="initial" />
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	await waitFor(() => {
		expect(screen.getByText('settings.chatHistory.empty')).toBeInTheDocument();
	});
});

it('resizes the sidebar with keyboard and pointer input and persists the width', async () => {
	listSessions.mockResolvedValue([]);
	const { container } = render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'home', setSessionId: jest.fn() }}>
				<PageContainer>
					<Split sidebar={<HomeSidebar refreshKey="initial" />}>
						<div>Workspace</div>
					</Split>
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);
	const resizer = screen.getByRole('separator', { name: 'Resize sidebar' });
	const toggle = screen.getByRole('button', { name: 'Toggle Sidebar' });
	const wrapper = container.querySelector('[data-slot="split-pane"]');
	const sidebar = container.querySelector('[data-slot="split-pane-sidebar"]');
	await screen.findByText('settings.chatHistory.empty');
	expect(sidebar).not.toContainElement(toggle);

	fireEvent.keyDown(resizer, { key: 'ArrowRight' });
	expect(resizer).toHaveAttribute('aria-valuenow', '264');
	expect(wrapper).toHaveStyle({ '--split-pane-sidebar-width': '264px' });

	fireEvent.pointerDown(resizer, { button: 0, clientX: 264 });
	fireEvent.pointerMove(window, { clientX: 320 });
	fireEvent.pointerUp(window);

	expect(resizer).toHaveAttribute('aria-valuenow', '320');
	expect(document.documentElement.style.getPropertyValue('--app-sidebar-width')).toBe('320px');
	expect(window.localStorage.getItem('kucedr_sidebar_width')).toBe('320');

	fireEvent.click(toggle);
	expect(toggle).toHaveAttribute('aria-expanded', 'false');
	expect(sidebar).toHaveAttribute('data-state', 'collapsed');
});
