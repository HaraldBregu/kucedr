import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NavigationBar } from '../../../src/renderer/src/components/app/navigationbar/NavigationBar';

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
		<MemoryRouter initialEntries={['/project']}>
			<NavigationBar />
			<Routes>
				<Route path="/project" element={null} />
				<Route path={path} element={<p>{path}</p>} />
			</Routes>
		</MemoryRouter>
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
		<MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
		</MemoryRouter>
	);

	fireEvent.contextMenu(screen.getByRole('button', { name: 'settings.title' }));

	expect(showContextMenu).not.toHaveBeenCalled();
});

it.each(['/settings', '/start'])('opens the navigationbar menu while viewing %s', (path) => {
	const { container } = render(
		<MemoryRouter initialEntries={[path]}>
			<NavigationBar />
		</MemoryRouter>
	);

	fireEvent.contextMenu(container.querySelector('[data-slot="navigationbar"]') as Element);

	expect(showContextMenu).toHaveBeenCalledWith(contextMenuItems);
});

it('hides application navigation during onboarding', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/start']}>
			<NavigationBar />
		</MemoryRouter>
	);

	const navigationBar = container.querySelector('[data-slot="navigationbar"]');
	expect(navigationBar).toHaveClass('bg-background');
	expect(navigationBar).not.toHaveClass('bg-transparent');
	expect(screen.queryByRole('button', { name: 'settings.title' })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'navigationBar.chat' })).not.toBeInTheDocument();
});

it('opens Account from the settings icon on Home', async () => {
	const user = userEvent.setup();

	render(
		<MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
			<Routes>
				<Route path="/home" element={null} />
				<Route path="/settings/account" element={<p>/settings/account</p>} />
			</Routes>
		</MemoryRouter>
	);

	expect(screen.getByRole('button', { name: 'settings.title' })).toBeInTheDocument();

	await user.click(screen.getByRole('button', { name: 'settings.title' }));

	expect(screen.getByText('/settings/account')).toBeInTheDocument();
});

it.each(['/home', '/settings/settings'])(
	'does not render the voice conversation button in the navbar on %s',
	(path) => {
		render(
			<MemoryRouter initialEntries={[path]}>
				<NavigationBar />
			</MemoryRouter>
		);

		expect(
			screen.queryByRole('button', { name: 'Start voice conversation' })
		).not.toBeInTheDocument();
	}
);

it('does not render a chat title in the navigationbar', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
		</MemoryRouter>
	);

	expect(container.querySelector('[data-slot="navigationbar-chat-title"]')).not.toBeInTheDocument();
	expect(container.querySelector('[data-slot="navigationbar-chat-context"]')).not.toBeInTheDocument();
});

it('renders Search and Workspace together on the right and opens Workspace', async () => {
	const user = userEvent.setup();
	const onSearch = jest.fn();

	render(
		<MemoryRouter initialEntries={['/home']}>
			<NavigationBar onSearch={onSearch} />
			<Routes>
				<Route path="/home" element={null} />
				<Route path="/workspace" element={<p>Workspace page</p>} />
			</Routes>
		</MemoryRouter>
	);
	const search = screen.getByRole('button', { name: 'navigationBar.search' });
	const workspace = screen.getByRole('button', { name: 'navigationBar.workspace' });

	expect(search.nextElementSibling).toBe(workspace);
	expect(workspace.querySelector('.lucide-folder')).toBeInTheDocument();
	await user.click(search);
	expect(onSearch).toHaveBeenCalledTimes(1);
	await user.click(workspace);
	expect(screen.getByText('Workspace page')).toBeInTheDocument();
});

it('renders one solid navigationbar color without visible title text', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
		</MemoryRouter>
	);
	const navigationBar = container.querySelector('[data-slot="navigationbar"]');

	expect(navigationBar).toHaveClass('bg-background');
	expect(navigationBar).not.toHaveClass('bg-transparent');
	expect(navigationBar).not.toHaveClass('app-translucent-surface');
	expect(within(navigationBar as HTMLElement).queryByText('Application Name')).not.toBeInTheDocument();
	expect(within(navigationBar as HTMLElement).queryByText('Kucedr')).not.toBeInTheDocument();
});

it('keeps the user icon linked to Account while viewing Settings', async () => {
	const user = userEvent.setup();

	render(
		<MemoryRouter initialEntries={['/settings/settings']}>
			<NavigationBar />
			<Routes>
				<Route path="/settings/settings" element={null} />
				<Route path="/settings/account" element={<p>/settings/account</p>} />
			</Routes>
		</MemoryRouter>
	);
	const settingsButton = screen.getByRole('button', { name: 'settings.title' });

	expect(settingsButton.querySelector('.lucide-user')).toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'navigationBar.chat' })).not.toBeInTheDocument();

	await user.click(settingsButton);

	expect(screen.getByText('/settings/account')).toBeInTheDocument();
});

it('does not render the sidebar toggle in the navigationbar', () => {
	render(
		<MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
		</MemoryRouter>
	);

	expect(screen.queryByRole('button', { name: 'navigationBar.toggleSidebar' })).not.toBeInTheDocument();
});

it.each(['/home', '/settings/settings'])('omits the Coder and standalone Workspace launch buttons on %s', (path) => {
	render(
		<MemoryRouter initialEntries={[path]}>
			<NavigationBar />
		</MemoryRouter>
	);

	expect(screen.queryByRole('button', { name: 'Open Coder' })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Open Workspace' })).not.toBeInTheDocument();
});

it('does not render route titles inside the navigationbar', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/settings/settings/persona']}>
			<NavigationBar />
		</MemoryRouter>
	);

	expect(container.querySelector('[data-slot="navigationbar-content"]')).not.toBeInTheDocument();
});
