import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PageContainer, Split } from '../../../src/renderer/src/components/app/base/page';
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
const compactSession = jest.fn();
const clearMessages = jest.fn();
const openSessionFolder = jest.fn();
const showContextMenu = jest.fn();
const signOut = jest.fn();
const confirmSignOut = jest.fn();
const openExternalUrl = jest.fn();
const openVoiceConversation = jest.fn();
const getMicrophonePermission = jest.fn();

beforeEach(() => {
	signOut.mockReset();
	signOut.mockResolvedValue(undefined);
	confirmSignOut.mockReset();
	confirmSignOut.mockResolvedValue(true);
	openExternalUrl.mockReset();
	openExternalUrl.mockResolvedValue(undefined);
	openVoiceConversation.mockReset().mockResolvedValue(undefined);
	getMicrophonePermission.mockReset().mockResolvedValue({
		enabled: true,
		systemStatus: 'granted',
		canRequest: false,
	});
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
		value: {
			listSessions,
			renameSession,
			deleteSession,
			compactSession,
			clearMessages,
			openSessionFolder,
		},
	});
	Object.defineProperty(window, 'win', {
		configurable: true,
		value: { showContextMenu, confirmSignOut, openVoiceConversation },
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: {
			openExternalUrl,
			getMicrophonePermission,
		},
	});
	Object.defineProperty(window, 'auth', {
		configurable: true,
		value: { signOut },
	});
});

it('loads chat history, marks the latest default session, and switches sessions', async () => {
	const user = userEvent.setup();
	const setSessionId = jest.fn();
	const setSessionTitle = jest.fn();
	listSessions.mockResolvedValue([
		{ id: 'session-latest', title: 'Latest chat', createdAtMs: 2, runStatus: 'running' },
		{ id: 'session-older', title: 'Older chat', createdAtMs: 1 },
	]);

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'home', setSessionId, setSessionTitle }}>
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
	const accountMenu = screen.getByRole('button', { name: 'settings.sidebar.accountMenu' });
	const footer = accountMenu.closest('[data-slot="sidebar-footer"]') as HTMLElement;
	expect(footer).toHaveClass('px-2', 'pt-1', 'pb-3');
	expect(accountMenu).toHaveClass('h-12', 'p-2');
	expect(within(accountMenu).getByText('settings.title')).toBeInTheDocument();
	expect(
		within(footer).getByText('S')
	).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'settings.sidebar.voiceConversation' })).toBeInTheDocument();
});

it.each<[AuthState, string]>([
	[
		{
			status: 'signedIn',
			persistence: 'encrypted',
			user: { id: 'user-1', email: 'ada@example.com', displayName: 'Ada Lovelace' },
		},
		'settings.tabs.account',
	],
	[
		{
			status: 'signedIn',
			persistence: 'encrypted',
			user: { id: 'user-2', email: 'grace@example.com' },
		},
		'settings.tabs.account',
	],
])('shows authenticated account identity and actions', async (state, accountName) => {
	const user = userEvent.setup();
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

	const accountMenu = screen.getByRole('button', { name: 'settings.sidebar.accountMenu' });
	const footer = accountMenu.closest('[data-slot="sidebar-footer"]');
	expect(footer).not.toBeNull();
	expect(within(accountMenu).getByText(accountName)).toBeInTheDocument();
	expect(accountMenu.querySelector('.rounded-md.grayscale')).toHaveClass('size-7');
	expect(accountMenu.querySelector('.lucide-more-vertical')).not.toBeInTheDocument();
	if (state.status === 'signedIn') {
		expect(within(accountMenu).queryByText(state.user.email)).not.toBeInTheDocument();
	}
	await user.click(accountMenu);
	const menu = screen.getByRole('menu');
	if (state.status === 'signedIn') {
		expect(within(menu).getByText(state.user.email)).toHaveClass('text-xs');
	}
	[
		['settings.tabs.account', '/settings/account'],
		['settings.sidebar.provider', '/settings/providers'],
		['settings.tabs.channels', '/settings/channels'],
		['settings.tabs.apps', '/settings/apps'],
	].forEach(([name, href]) => {
		expect(within(menu).getByRole('menuitem', { name })).toHaveAttribute('href', href);
	});
	expect(
		within(menu).queryByRole('menuitem', { name: 'settings.tabs.cloud' })
	).not.toBeInTheDocument();
	expect(
		within(menu).queryByRole('menuitem', { name: 'settings.sidebar.assistant' })
	).not.toBeInTheDocument();
	await user.click(within(menu).getByRole('menuitem', { name: 'settings.sidebar.signOut' }));
	expect(confirmSignOut).toHaveBeenCalledTimes(1);
	await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
	await screen.findByText('settings.chatHistory.empty');
});

it('opens voice from its own footer button without opening the account menu', async () => {
	const user = userEvent.setup();
	listSessions.mockResolvedValue([]);

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'session-voice', setSessionId: jest.fn() }}>
				<PageContainer>
					<HomeSidebar refreshKey="initial" />
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	const voiceButton = screen.getByRole('button', { name: 'settings.sidebar.voiceConversation' });
	expect(voiceButton).toHaveClass(
		'size-8',
		'top-2',
		'hover:bg-sidebar-primary',
		'hover:text-sidebar-primary-foreground'
	);
	await user.click(voiceButton);

	await waitFor(() => expect(openVoiceConversation).toHaveBeenCalledWith('session-voice'));
	expect(getMicrophonePermission).toHaveBeenCalledTimes(1);
	expect(screen.queryByRole('menu')).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'settings.sidebar.accountMenu' }));
	expect(screen.getByRole('menu')).toBeInTheDocument();
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
		{ id: 'clear', label: 'settings.chatHistory.clear' },
		{ id: 'compact', label: 'settings.chatHistory.compact' },
		{ id: 'open-location', label: 'navigationBar.openLocation' },
		{ id: 'delete', label: 'common.delete' },
	]);
	const input = await screen.findByRole('textbox', { name: 'Rename Latest chat' });
	await user.clear(input);
	await user.type(input, 'Named chat{Enter}');
	await waitFor(() => expect(renameSession).toHaveBeenCalledWith('session-latest', 'Named chat'));
});

it('requires confirmation before compacting a chat and refreshes its snapshot', async () => {
	const user = userEvent.setup();
	listSessions.mockResolvedValue([{ id: 'session-latest', title: 'Latest chat', createdAtMs: 2 }]);
	showContextMenu.mockResolvedValue('compact');
	compactSession.mockResolvedValue({
		status: 'compacted',
		retainedMessages: 9,
		removedMessages: 12,
	});
	const refresh = jest.fn();
	window.addEventListener('kucedr:session-compacted', refresh);

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'session-latest', setSessionId: jest.fn() }}>
				<PageContainer>
					<HomeSidebar refreshKey="initial" />
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	fireEvent.contextMenu(await screen.findByRole('button', { name: 'Latest chat' }));
	const dialog = await screen.findByRole('dialog');
	expect(within(dialog).getByText('settings.chatHistory.confirmCompact')).toBeInTheDocument();
	expect(compactSession).not.toHaveBeenCalled();
	await user.click(within(dialog).getByRole('button', { name: 'settings.chatHistory.compact' }));
	await waitFor(() => expect(compactSession).toHaveBeenCalledWith('session-latest'));
	expect(refresh).toHaveBeenCalled();
	window.removeEventListener('kucedr:session-compacted', refresh);
});

it('clears only the chosen chat after confirmation and refreshes its transcript', async () => {
	const user = userEvent.setup();
	listSessions.mockResolvedValue([{ id: 'session-latest', title: 'Latest chat', createdAtMs: 2 }]);
	showContextMenu.mockResolvedValue('clear');
	clearMessages.mockResolvedValue(undefined);
	const refresh = jest.fn();
	window.addEventListener('kucedr:session-history-cleared', refresh);
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
	let dialog = await screen.findByRole('dialog');
	await user.click(within(dialog).getByRole('button', { name: 'common.cancel' }));
	expect(clearMessages).not.toHaveBeenCalled();
	fireEvent.contextMenu(chat);
	dialog = await screen.findByRole('dialog');
	await user.click(within(dialog).getByRole('button', { name: 'settings.chatHistory.clear' }));
	await waitFor(() => expect(clearMessages).toHaveBeenCalledWith('session-latest'));
	expect(refresh).toHaveBeenCalled();
	expect(screen.getByRole('button', { name: 'Latest chat' })).toBeInTheDocument();
	window.removeEventListener('kucedr:session-history-cleared', refresh);
});

it('opens a chat location from its context menu', async () => {
	listSessions.mockResolvedValue([{ id: 'session-latest', title: 'Latest chat', createdAtMs: 2 }]);
	showContextMenu.mockResolvedValue('open-location');
	openSessionFolder.mockResolvedValue(undefined);

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'session-latest', setSessionId: jest.fn() }}>
				<PageContainer>
					<HomeSidebar refreshKey="initial" />
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	fireEvent.contextMenu(await screen.findByRole('button', { name: 'Latest chat' }));
	await waitFor(() => expect(openSessionFolder).toHaveBeenCalledWith('session-latest'));
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
	const setSessionTitle = jest.fn();
	listSessions.mockResolvedValue([]);
	Object.defineProperty(globalThis.crypto, 'randomUUID', {
		configurable: true,
		value: jest.fn(() => '00000000-0000-4000-8000-000000000001'),
	});

	render(
		<MemoryRouter>
			<ChatSessionContext.Provider value={{ sessionId: 'home', setSessionId, setSessionTitle }}>
				<PageContainer>
					<HomeSidebar refreshKey="initial" />
				</PageContainer>
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	const newChat = screen.getByRole('button', { name: 'navigationBar.newChat' });
	expect(newChat).toHaveAttribute('data-sidebar', 'menu-button');
	expect(newChat.parentElement).toHaveAttribute('data-sidebar', 'menu-item');
	expect(newChat.querySelector('.lucide-plus')).toBeInTheDocument();
	expect(newChat).toHaveTextContent('navigationBar.newChat');
	expect(newChat.querySelector('kbd')).not.toBeInTheDocument();
	expect(screen.queryByText('navigationBar.workspace')).not.toBeInTheDocument();
	await user.click(newChat);
	expect(setSessionId).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
	expect(setSessionTitle).toHaveBeenCalledWith('navigationBar.newChat');
});

it('shows Search, Settings and Get Help as sidebar items above the footer', async () => {
	const user = userEvent.setup();
	listSessions.mockResolvedValue([]);

	render(
		<MemoryRouter initialEntries={['/home']}>
			<Routes>
				<Route
					path="/home"
					element={
						<ChatSessionContext.Provider value={{ sessionId: 'home', setSessionId: jest.fn() }}>
							<PageContainer>
								<HomeSidebar refreshKey="initial" />
							</PageContainer>
						</ChatSessionContext.Provider>
					}
				/>
				<Route path="/settings/apps" element={<p>Apps page</p>} />
				<Route path="/settings/settings" element={<p>Settings page</p>} />
			</Routes>
		</MemoryRouter>
	);

	await screen.findByText('settings.chatHistory.empty');
	expect(screen.getByRole('button', { name: 'settings.title', exact: true }).closest('[data-slot="sidebar-footer"]')).toBeNull();
	expect(screen.getByRole('button', { name: 'settings.sidebar.help' }).closest('[data-slot="sidebar-footer"]')).toBeNull();
	expect(
		screen.queryByRole('button', { name: 'settings.sidebar.getHelp' })
	).not.toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'navigationBar.search' }).closest('[data-slot="sidebar-footer"]')).toBeNull();
	const accountMenu = screen.getByRole('button', { name: 'settings.sidebar.accountMenu' });
	expect(accountMenu.closest('[data-slot="sidebar-footer"]')).not.toBeNull();
	await user.click(accountMenu);
	expect(screen.queryByRole('menuitem', { name: 'navigationBar.search' })).not.toBeInTheDocument();
	expect(screen.queryByRole('menuitem', { name: 'settings.sidebar.getHelp' })).not.toBeInTheDocument();
	expect(screen.getByRole('menuitem', { name: 'settings.tabs.settings' }).querySelector('.lucide-settings')).toBeInTheDocument();
	await user.click(accountMenu);
	await user.click(screen.getByRole('button', { name: 'settings.sidebar.help' }));
	expect(openExternalUrl).toHaveBeenCalledWith('https://www.kucedr.com/help');
	await user.click(screen.getByRole('button', { name: 'settings.title', exact: true }));
	expect(screen.getByText('Settings page')).toBeInTheDocument();
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
	expect(toggle).toHaveClass('size-8', 'rounded-full', 'aria-expanded:bg-transparent');
	expect(toggle).not.toHaveClass('size-7', 'text-muted-foreground');
	expect(sidebar).toHaveClass('top-12', 'bottom-0', 'border-r', 'bg-background');
	expect(resizer).toHaveAttribute('aria-valuenow', '224');
	expect(wrapper).toHaveStyle({ '--split-pane-sidebar-width': '224px' });

	fireEvent.keyDown(resizer, { key: 'ArrowRight' });
	expect(resizer).toHaveAttribute('aria-valuenow', '232');
	expect(wrapper).toHaveStyle({ '--split-pane-sidebar-width': '232px' });

	fireEvent.pointerDown(resizer, { button: 0, clientX: 232 });
	fireEvent.pointerMove(window, { clientX: 320 });
	fireEvent.pointerUp(window);

	expect(resizer).toHaveAttribute('aria-valuenow', '320');
	expect(document.documentElement.style.getPropertyValue('--app-sidebar-width')).toBe('320px');
	expect(window.localStorage.getItem('kucedr_sidebar_width')).toBe('320');

	fireEvent.click(toggle);
	expect(toggle).toHaveAttribute('aria-expanded', 'false');
	expect(sidebar).toHaveAttribute('data-state', 'collapsed');
});
