import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TitleBar } from '../../../src/renderer/src/components/app/titlebar/TitleBar';
import { ChatSessionContext } from '../../../src/renderer/src/contexts/chat-session';
import { SettingsBreadcrumb } from '../../../src/renderer/src/pages/settings/Breadcrumb';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

const showContextMenu = jest.fn();
const renameSession = jest.fn();
const deleteSession = jest.fn();
const contextMenuItems = [
	{ id: '/settings/general', label: 'settings.tabs.general' },
	{ id: '/settings/agent', label: 'settings.overview.groups.agent' },
	{ id: '/settings/system', label: 'settings.tabs.system' },
	{ id: '/settings/apps', label: 'settings.tabs.apps' },
];

beforeEach(() => {
	showContextMenu.mockReset().mockResolvedValue(null);
	renameSession.mockReset().mockResolvedValue(undefined);
	deleteSession.mockReset().mockResolvedValue(undefined);
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: { renameSession, deleteSession },
	});
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
	['settings.tabs.general', '/settings/general'],
	['settings.overview.groups.agent', '/settings/agent'],
	['settings.tabs.system', '/settings/system'],
	['settings.tabs.apps', '/settings/apps'],
])('opens a native context menu and navigates from %s to %s', async (_label, path) => {
	showContextMenu.mockResolvedValue(path);
	const { container } = render(
		<MemoryRouter initialEntries={['/project']}>
			<TitleBar />
			<Routes>
				<Route path="/project" element={null} />
				<Route path={path} element={<p>{path}</p>} />
			</Routes>
		</MemoryRouter>
	);
	const titleBar = container.querySelector('[data-slot="titlebar"]');

	expect(titleBar).not.toBeNull();
	const contextMenuEvent = new MouseEvent('contextmenu', {
		bubbles: true,
		cancelable: true,
	});
	fireEvent(titleBar as Element, contextMenuEvent);

	expect(contextMenuEvent.defaultPrevented).toBe(true);
	expect(showContextMenu).toHaveBeenCalledWith(contextMenuItems);
	await waitFor(() => expect(screen.getByText(path)).toBeInTheDocument());
});

it('does not open the titlebar menu from a button', () => {
	render(
		<MemoryRouter initialEntries={['/home']}>
			<TitleBar />
		</MemoryRouter>
	);

	fireEvent.contextMenu(screen.getByRole('button', { name: 'settings.title' }));

	expect(showContextMenu).not.toHaveBeenCalled();
});

it.each(['/settings', '/start'])('opens the titlebar menu while viewing %s', (path) => {
	const { container } = render(
		<MemoryRouter initialEntries={[path]}>
			<TitleBar />
		</MemoryRouter>
	);

	fireEvent.contextMenu(container.querySelector('[data-slot="titlebar"]') as Element);

	expect(showContextMenu).toHaveBeenCalledWith(contextMenuItems);
});

it('hides application navigation during onboarding', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/start']}>
			<TitleBar />
		</MemoryRouter>
	);

	const titleBar = container.querySelector('[data-slot="titlebar"]');
	expect(titleBar).toHaveClass('bg-background');
	expect(titleBar).not.toHaveClass('bg-transparent');
	expect(screen.queryByRole('button', { name: 'settings.title' })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'titleBar.home' })).not.toBeInTheDocument();
});

it('shows the settings icon on Home', async () => {
	const user = userEvent.setup();

	render(
		<MemoryRouter initialEntries={['/home']}>
			<TitleBar />
			<Routes>
				<Route path="/home" element={null} />
				<Route path="/settings/general" element={<p>/settings/general</p>} />
			</Routes>
		</MemoryRouter>
	);

	expect(screen.getByRole('button', { name: 'settings.title' })).toBeInTheDocument();

	await user.click(screen.getByRole('button', { name: 'settings.title' }));

	expect(screen.getByText('/settings/general')).toBeInTheDocument();
});

it('shows the current chat title and its dropdown on the left of the Home titlebar', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/home']}>
			<ChatSessionContext.Provider
				value={{ sessionId: 'session-1', setSessionId: jest.fn(), sessionTitle: 'Project roadmap' }}
			>
				<TitleBar sidebarOpen />
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	expect(screen.getByText('Project roadmap')).toHaveAttribute('data-slot', 'titlebar-chat-title');
	expect(document.querySelector('[data-slot="titlebar-chat-context"]')).toHaveClass('ml-3');
	await user.click(screen.getByRole('button', { name: 'settings.chatHistory.title' }));
	expect(screen.getByRole('menuitem', { name: 'settings.tabs.general' })).toBeInTheDocument();
	expect(screen.getByRole('menuitem', { name: 'settings.overview.groups.agent' })).toBeInTheDocument();
	expect(screen.getByRole('menuitem', { name: 'settings.tabs.system' })).toBeInTheDocument();
	expect(screen.getByRole('menuitem', { name: 'settings.tabs.apps' })).toBeInTheDocument();
});

it('places the current chat after the sidebar toggle when the sidebar is closed', () => {
	render(
		<MemoryRouter initialEntries={['/home']}>
			<ChatSessionContext.Provider
				value={{ sessionId: 'session-1', setSessionId: jest.fn(), sessionTitle: 'Project roadmap' }}
			>
				<TitleBar sidebarOpen={false} />
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	expect(document.querySelector('[data-slot="titlebar-chat-context"]')).toHaveClass('ml-28');
});

it('renames the current chat from the titlebar dropdown', async () => {
	const user = userEvent.setup();
	const setSessionTitle = jest.fn();
	render(
		<MemoryRouter initialEntries={['/home']}>
			<ChatSessionContext.Provider
				value={{
					sessionId: 'session-1',
					setSessionId: jest.fn(),
					sessionTitle: 'Project roadmap',
					sessionTitleSessionId: 'session-1',
					setSessionTitle,
				}}
			>
				<TitleBar />
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	await user.click(screen.getByRole('button', { name: 'settings.chatHistory.title' }));
	await user.click(screen.getByRole('menuitem', { name: 'common.rename' }));
	const input = await screen.findByRole('textbox', { name: 'common.rename' });
	await user.clear(input);
	await user.type(input, 'Launch plan');
	fireEvent.blur(input);

	await waitFor(() => expect(renameSession).toHaveBeenCalledWith('session-1', 'Launch plan'));
	expect(setSessionTitle).toHaveBeenCalledWith('Launch plan', 'session-1');
});

it('deletes the current chat from the titlebar dropdown after confirmation', async () => {
	const user = userEvent.setup();
	const setSessionId = jest.fn();
	const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
	render(
		<MemoryRouter initialEntries={['/home']}>
			<ChatSessionContext.Provider
				value={{
					sessionId: 'session-1',
					setSessionId,
					sessionTitle: 'Project roadmap',
					sessionTitleSessionId: 'session-1',
				}}
			>
				<TitleBar />
			</ChatSessionContext.Provider>
		</MemoryRouter>
	);

	await user.click(screen.getByRole('button', { name: 'settings.chatHistory.title' }));
	await user.click(screen.getByRole('menuitem', { name: 'common.delete' }));

	await waitFor(() => expect(deleteSession).toHaveBeenCalledWith('session-1'));
	expect(setSessionId).toHaveBeenCalledTimes(1);
	confirm.mockRestore();
});

it('renders search immediately before the Home or Settings button', async () => {
	const user = userEvent.setup();
	const onSearch = jest.fn();

	render(
		<MemoryRouter initialEntries={['/home']}>
			<TitleBar onSearch={onSearch} />
		</MemoryRouter>
	);
	const search = screen.getByRole('button', { name: 'titleBar.search' });
	const settings = screen.getByRole('button', { name: 'settings.title' });

	expect(search.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	await user.click(search);
	expect(onSearch).toHaveBeenCalledTimes(1);
});

it('renders a transparent titlebar without visible title text', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/home']}>
			<TitleBar />
		</MemoryRouter>
	);
	const titleBar = container.querySelector('[data-slot="titlebar"]');

	expect(titleBar).toHaveClass('bg-transparent');
	expect(titleBar).not.toHaveClass('app-translucent-surface');
	expect(within(titleBar as HTMLElement).queryByText('Application Name')).not.toBeInTheDocument();
	expect(within(titleBar as HTMLElement).queryByText('Kucedr')).not.toBeInTheDocument();
});

it('shows the Kucedr logo and Home label inside the Settings button', async () => {
	const user = userEvent.setup();

	render(
		<MemoryRouter initialEntries={['/settings']}>
			<TitleBar />
			<Routes>
				<Route path="/settings" element={null} />
				<Route path="/home" element={<p>/home</p>} />
			</Routes>
		</MemoryRouter>
	);
	const homeButton = screen.getByRole('button', { name: 'titleBar.home' });

	expect(within(homeButton).getByRole('img', { name: 'Kucedr logo' })).toBeInTheDocument();
	expect(within(homeButton).getByText('titleBar.home')).toBeInTheDocument();

	await user.click(homeButton);

	expect(screen.getByText('/home')).toBeInTheDocument();
});

it('does not render the sidebar toggle in the titlebar', () => {
	render(
		<MemoryRouter initialEntries={['/home']}>
			<TitleBar />
		</MemoryRouter>
	);

	expect(screen.queryByRole('button', { name: 'titleBar.toggleSidebar' })).not.toBeInTheDocument();
});

it('renders settings breadcrumbs inside the titlebar', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/settings/general/persona']}>
			<TitleBar centerContent={<SettingsBreadcrumb />} />
		</MemoryRouter>
	);
	const titleBar = container.querySelector('[data-slot="titlebar"]');
	const breadcrumb = within(titleBar as HTMLElement).getByRole('navigation', {
		name: 'settings.breadcrumb.label',
	});

	expect(within(breadcrumb).getByRole('link', { name: 'settings.tabs.general' })).toHaveAttribute(
		'href',
		'/settings/general'
	);
	expect(within(breadcrumb).getByText('settings.voiceAgent.title')).toBeInTheDocument();
});

it('does not open the titlebar menu from a breadcrumb link', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/settings/general/persona']}>
			<TitleBar centerContent={<SettingsBreadcrumb />} />
		</MemoryRouter>
	);
	const titleBar = container.querySelector('[data-slot="titlebar"]');
	const breadcrumbLink = within(titleBar as HTMLElement).getByRole('link', {
		name: 'settings.tabs.general',
	});

	fireEvent.contextMenu(breadcrumbLink);
	expect(showContextMenu).not.toHaveBeenCalled();
});
