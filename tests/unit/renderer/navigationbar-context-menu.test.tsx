import { Provider as PageProvider } from '../../../src/renderer/src/components/app/base/page/Provider';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NavigationBar } from '../../../src/renderer/src/components/app/navigationbar/NavigationBar';
import userEvent from '@testing-library/user-event';
import { ChatSessionContext } from '../../../src/renderer/src/contexts/chat-session';
import type { AgentSessionSummary } from '../../../src/shared/agent_types';

jest.mock('@/contexts', () => ({
	useApp: () => ({ theme: 'system', setTheme: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

const showContextMenu = jest.fn();
const contextMenuItems = [
	{ id: '/settings/settings', label: 'settings.tabs.settings' },
	{ id: '/settings/agent', label: 'settings.overview.groups.agent' },
	{ id: '/settings/apps', label: 'settings.tabs.apps' },
];

beforeEach(() => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: jest.fn(() => ({
			matches: false,
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		})),
	});
	showContextMenu.mockReset().mockResolvedValue(null);
	Object.defineProperty(window, 'win', {
		configurable: true,
		value: {
			isFullScreen: jest.fn().mockResolvedValue(false),
			isMaximized: jest.fn().mockResolvedValue(false),
			onFullScreenChange: jest.fn(() => jest.fn()),
			onMaximizeChange: jest.fn(() => jest.fn()),
			showContextMenu,
		},
	});
});

it.each([
	['settings.tabs.settings', '/settings/settings'],
	['settings.overview.groups.agent', '/settings/agent'],
	['settings.tabs.apps', '/settings/apps'],
])('opens a native context menu and navigates from %s to %s', async (_label, path) => {
	showContextMenu.mockResolvedValue(path);
	const { container } = render(
		<PageProvider><MemoryRouter initialEntries={['/project']}>
			<NavigationBar />
			<Routes>
				<Route path="/project" element={null} />
				<Route path={path} element={<p>{path}</p>} />
			</Routes>
		</MemoryRouter></PageProvider>
	);
	const navigationBar = container.querySelector('[data-slot="navigationbar"]');

	expect(navigationBar).not.toBeNull();
	const contextMenuEvent = new MouseEvent('contextmenu', {
		bubbles: true,
		cancelable: true,
	});
	fireEvent(navigationBar as Element, contextMenuEvent);

	expect(contextMenuEvent.defaultPrevented).toBe(true);
	expect(showContextMenu).toHaveBeenCalledWith(contextMenuItems);
	await waitFor(() => expect(screen.getByText(path)).toBeInTheDocument());
});

it('does not open the navigationbar menu from a button', () => {
	render(
		<PageProvider><MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
		</MemoryRouter></PageProvider>
	);

	fireEvent.contextMenu(screen.getByRole('button', { name: 'settings.theme.title: settings.theme.dark' }));

	expect(showContextMenu).not.toHaveBeenCalled();
});

it.each(['/settings', '/start'])('opens the navigationbar menu while viewing %s', (path) => {
	const { container } = render(
		<PageProvider><MemoryRouter initialEntries={[path]}>
			<NavigationBar />
		</MemoryRouter></PageProvider>
	);

	fireEvent.contextMenu(container.querySelector('[data-slot="navigationbar"]') as Element);

	expect(showContextMenu).toHaveBeenCalledWith(contextMenuItems);
});

it('hides application navigation during onboarding', () => {
	const { container } = render(
		<PageProvider><MemoryRouter initialEntries={['/start']}>
			<NavigationBar />
		</MemoryRouter></PageProvider>
	);

	const navigationBar = container.querySelector('[data-slot="navigationbar"]');
	expect(navigationBar).toHaveClass('bg-background');
	expect(navigationBar).not.toHaveClass('bg-transparent');
	expect(screen.queryByRole('button', { name: 'settings.title' })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'navigationBar.chat' })).not.toBeInTheDocument();
});

it('omits the Account icon but keeps Search on Home', () => {
	render(
		<PageProvider><MemoryRouter initialEntries={['/home']}>
			<NavigationBar showWorkspace />
		</MemoryRouter></PageProvider>
	);

	expect(screen.queryByRole('button', { name: 'settings.title' })).not.toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'navigationBar.search' })).toBeInTheDocument();
});

it.each(['/home', '/settings/settings'])(
	'does not render the Voice button in the navbar on %s',
	(path) => {
		render(
			<PageProvider><MemoryRouter initialEntries={[path]}>
				<NavigationBar />
			</MemoryRouter></PageProvider>
		);

		expect(
			screen.queryByRole('button', { name: 'Start Voice' })
		).not.toBeInTheDocument();
	}
);

it('does not render a chat title in the navigationbar', () => {
	const { container } = render(
		<PageProvider><MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
		</MemoryRouter></PageProvider>
	);

	expect(container.querySelector('[data-slot="navigationbar-chat-title"]')).not.toBeInTheDocument();
	expect(container.querySelector('[data-slot="navigationbar-chat-context"]')).not.toBeInTheDocument();
});

it('omits Space and Code while keeping Chat navigation on the right', () => {
	render(
		<PageProvider><MemoryRouter initialEntries={['/home']}>
			<NavigationBar showWorkspace />
		</MemoryRouter></PageProvider>
	);

	expect(screen.queryByRole('button', { name: 'navigationBar.space' })).not.toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'navigationBar.chat' })).toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'navigationBar.code' })).not.toBeInTheDocument();
});

it('renders one solid navigationbar color without visible title text', () => {
	const { container } = render(
		<PageProvider><MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
		</MemoryRouter></PageProvider>
	);
	const navigationBar = container.querySelector('[data-slot="navigationbar"]');

	expect(navigationBar).toHaveClass('bg-background');
	expect(navigationBar).not.toHaveClass('bg-transparent');
	expect(navigationBar).not.toHaveClass('app-translucent-surface');
	expect(within(navigationBar as HTMLElement).queryByText('Application Name')).not.toBeInTheDocument();
	expect(within(navigationBar as HTMLElement).queryByText('Kucedr')).not.toBeInTheDocument();
});

it('omits the Account icon while viewing Settings', () => {
	render(
		<PageProvider><MemoryRouter initialEntries={['/settings/settings']}>
			<NavigationBar />
		</MemoryRouter></PageProvider>
	);

	expect(screen.queryByRole('button', { name: 'settings.title' })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'navigationBar.chat' })).not.toBeInTheDocument();
});

it('does not render the sidebar toggle in the navigationbar', () => {
	render(
		<PageProvider><MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
		</MemoryRouter></PageProvider>
	);

	expect(screen.queryByRole('button', { name: 'navigationBar.toggleSidebar' })).not.toBeInTheDocument();
});

it.each(['/home', '/settings/settings'])('omits the Coder and standalone Workspace launch buttons on %s', (path) => {
	render(
		<PageProvider><MemoryRouter initialEntries={[path]}>
			<NavigationBar />
		</MemoryRouter></PageProvider>
	);

	expect(screen.queryByRole('button', { name: 'Open Coder' })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Open Workspace' })).not.toBeInTheDocument();
});

it('does not render route titles inside the navigationbar', () => {
	const { container } = render(
		<PageProvider><MemoryRouter initialEntries={['/settings/settings/persona']}>
			<NavigationBar />
		</MemoryRouter></PageProvider>
	);

	expect(container.querySelector('[data-slot="navigationbar-content"]')).not.toBeInTheDocument();
});

it('reveals the active chat session after loading and when history reopens', async () => {
	const user = userEvent.setup();
	const scrollIntoView = jest.fn();
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
	const sessions: AgentSessionSummary[] = [
		{ id: 'recent', title: 'Recent session', category: 'chat', createdAtMs: 2 },
		{ id: 'older', title: 'Selected session', category: 'chat', createdAtMs: 1 },
	];
	let finishLoading!: (sessions: AgentSessionSummary[]) => void;
	const listSessions = jest.fn().mockResolvedValue(sessions).mockImplementationOnce(() => new Promise<AgentSessionSummary[]>((resolve) => { finishLoading = resolve; }));
	Object.defineProperty(window, 'agent', { configurable: true, value: { listSessions } });
	render(
		<PageProvider><MemoryRouter initialEntries={['/home']}>
			<ChatSessionContext.Provider value={{ sessionId: 'older', setSessionId: jest.fn() }}>
				<NavigationBar showWorkspace />
			</ChatSessionContext.Provider>
		</MemoryRouter></PageProvider>
	);
	await user.click(screen.getByRole('button', { name: 'settings.chatHistory.title' }));
	expect(screen.getByText('settings.chatHistory.loading')).toBeInTheDocument();
	finishLoading(sessions);
	let selected = await screen.findByRole('menuitem', { name: 'Selected session' });
	await waitFor(() => expect(selected).toHaveFocus());
	expect(selected).toHaveAttribute('aria-current', 'page');
	expect(scrollIntoView.mock.contexts).toContain(selected);
	await user.keyboard('{Escape}');
	await user.click(screen.getByRole('button', { name: 'settings.chatHistory.title' }));
	selected = await screen.findByRole('menuitem', { name: 'Selected session' });
	await waitFor(() => expect(selected).toHaveFocus());
	expect(scrollIntoView.mock.contexts).toContain(selected);
	expect(listSessions).toHaveBeenCalledTimes(2);
});


it('shows the active chat in the sidebar-aligned header', () => {
	const { container } = render(
		<PageProvider><MemoryRouter initialEntries={['/home']}>
			<ChatSessionContext.Provider value={{ sessionId: 'session-1', sessionTitle: 'Navigation refresh', setSessionId: jest.fn() }}>
				<NavigationBar showWorkspace />
			</ChatSessionContext.Provider>
		</MemoryRouter></PageProvider>
	);
	expect(container.querySelector('[data-slot="navigationbar-context"]')).toHaveTextContent('Navigation refresh');
	expect(screen.getByText('Kucedr')).toBeInTheDocument();
});


it('keeps the current chat context beside the toggle when the sidebar is closed', () => {
	const { container } = render(
		<PageProvider initialState={{ sidebarOpen: false }}><MemoryRouter initialEntries={['/home']}>
			<NavigationBar showWorkspace />
		</MemoryRouter></PageProvider>
	);
	expect(container.querySelector('[data-slot="navigationbar-context"]')).toHaveTextContent('navigationBar.newChat');
	expect(screen.queryByText('Kucedr')).not.toBeInTheDocument();
});
