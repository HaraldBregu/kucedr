import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NavigationBar } from '../../../src/renderer/src/components/app/navigationbar/NavigationBar';
import { SettingsBreadcrumb } from '../../../src/renderer/src/pages/settings/Breadcrumb';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

const showContextMenu = jest.fn();
const contextMenuItems = [
	{ id: '/settings/general', label: 'settings.tabs.general' },
	{ id: '/settings/agent', label: 'settings.overview.groups.agent' },
	{ id: '/settings/system', label: 'settings.tabs.system' },
	{ id: '/settings/apps', label: 'settings.tabs.apps' },
];

beforeEach(() => {
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
	['settings.tabs.general', '/settings/general'],
	['settings.overview.groups.agent', '/settings/agent'],
	['settings.tabs.system', '/settings/system'],
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
	expect(screen.queryByRole('button', { name: 'navigationBar.home' })).not.toBeInTheDocument();
});

it('shows the settings icon on Home', async () => {
	const user = userEvent.setup();

	render(
		<MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
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

it('does not render a chat title in the navigationbar', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
		</MemoryRouter>
	);

	expect(container.querySelector('[data-slot="navigationbar-chat-title"]')).not.toBeInTheDocument();
	expect(container.querySelector('[data-slot="navigationbar-chat-context"]')).not.toBeInTheDocument();
});

it('renders search immediately before the Home or Settings button', async () => {
	const user = userEvent.setup();
	const onSearch = jest.fn();

	render(
		<MemoryRouter initialEntries={['/home']}>
			<NavigationBar onSearch={onSearch} />
		</MemoryRouter>
	);
	const search = screen.getByRole('button', { name: 'navigationBar.search' });
	const settings = screen.getByRole('button', { name: 'settings.title' });

	expect(search.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	await user.click(search);
	expect(onSearch).toHaveBeenCalledTimes(1);
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

it('shows the Kucedr logo and Home label inside the Settings button', async () => {
	const user = userEvent.setup();

	render(
		<MemoryRouter initialEntries={['/settings']}>
			<NavigationBar />
			<Routes>
				<Route path="/settings" element={null} />
				<Route path="/home" element={<p>/home</p>} />
			</Routes>
		</MemoryRouter>
	);
	const homeButton = screen.getByRole('button', { name: 'navigationBar.home' });

	expect(within(homeButton).getByRole('img', { name: 'Kucedr logo' })).toBeInTheDocument();
	expect(within(homeButton).getByText('navigationBar.home')).toBeInTheDocument();

	await user.click(homeButton);

	expect(screen.getByText('/home')).toBeInTheDocument();
});

it('does not render the sidebar toggle in the navigationbar', () => {
	render(
		<MemoryRouter initialEntries={['/home']}>
			<NavigationBar />
		</MemoryRouter>
	);

	expect(screen.queryByRole('button', { name: 'navigationBar.toggleSidebar' })).not.toBeInTheDocument();
});

it('renders settings breadcrumbs inside the navigationbar', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/settings/general/persona']}>
			<NavigationBar centerContent={<SettingsBreadcrumb />} />
		</MemoryRouter>
	);
	const navigationBar = container.querySelector('[data-slot="navigationbar"]');
	const breadcrumb = within(navigationBar as HTMLElement).getByRole('navigation', {
		name: 'settings.breadcrumb.label',
	});

	expect(within(breadcrumb).getByRole('link', { name: 'settings.tabs.general' })).toHaveAttribute(
		'href',
		'/settings/general'
	);
	expect(within(breadcrumb).getByText('settings.voiceAgent.title')).toBeInTheDocument();
});

it('does not open the navigationbar menu from a breadcrumb link', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/settings/general/persona']}>
			<NavigationBar centerContent={<SettingsBreadcrumb />} />
		</MemoryRouter>
	);
	const navigationBar = container.querySelector('[data-slot="navigationbar"]');
	const breadcrumbLink = within(navigationBar as HTMLElement).getByRole('link', {
		name: 'settings.tabs.general',
	});

	fireEvent.contextMenu(breadcrumbLink);
	expect(showContextMenu).not.toHaveBeenCalled();
});
