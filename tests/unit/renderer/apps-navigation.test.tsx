import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../../../src/renderer/src/pages/settings/Layout';
import AppsPage from '../../../src/renderer/src/pages/settings/pages/apps/Page';
import type { App } from '../../../src/shared/installed_app_types';

jest.mock('react-i18next', () => {
	const t = (key: string, values?: Record<string, string>): string =>
		values ? `${key} ${JSON.stringify(values)}` : key;
	return {
		useTranslation: () => ({ t }),
		initReactI18next: { type: '3rdParty', init: () => undefined },
	};
});

jest.mock('../../../src/renderer/src/components/app/navigationbar/NavigationBar', () => ({
	NavigationBar: ({ contextContent }: { contextContent?: unknown }) => contextContent ?? null,
}));

const apps: App[] = [
	{
		id: 'demo-app',
		title: 'Demo App',
		handle: '@example',
		description: 'A demo app.',
		metadata: {
			version: '1.0.0',
			category: 'Demo',
			entry: 'index.html',
		},
	},
];

const debugApp: App = {
	...apps[0],
	debugPath: '/projects/demo-app',
	imageUrl: 'kucedr-app://demo-app/assets/images/logo.png',
};

beforeEach(() => {
	Object.assign(globalThis, { __VITE_ENV__: { DEV: true, PROD: false } });
	Object.defineProperty(window, 'apps', {
		configurable: true,
		value: {
			list: jest.fn().mockResolvedValue(apps),
			open: jest.fn(),
			openRoot: jest.fn(),
			delete: jest.fn().mockResolvedValue(undefined),
			import: jest.fn(),
			addDebug: jest.fn(),
			selectDebugPath: jest.fn(),
		},
	});
	Object.defineProperty(window, 'plugins', {
		configurable: true,
		value: { list: jest.fn().mockResolvedValue([]) },
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
});

it('shows a debug app badge and image preview', async () => {
	(window.apps.list as jest.Mock).mockResolvedValue([debugApp]);
	render(
		<MemoryRouter>
			<AppsPage />
		</MemoryRouter>
	);

	const title = await screen.findByText('Demo App');
	expect(title.parentElement).toHaveTextContent('settings.apps.debug.badge');
	expect(title.closest('[data-slot="card"]')?.querySelector('img')).toHaveAttribute(
		'src',
		debugApp.imageUrl
	);
});

it('shows only an open action on app cards', async () => {
	render(
		<MemoryRouter>
			<AppsPage />
		</MemoryRouter>
	);

	await screen.findByText('Demo App');
	expect(screen.getByRole('button', { name: 'settings.apps.open' })).toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'settings.apps.details' })).not.toBeInTheDocument();
	expect(
		screen.queryByRole('button', { name: /settings.apps.deleteAction/ })
	).not.toBeInTheDocument();
});

it('opens an app from its card action', async () => {
	const user = userEvent.setup();
	(window.apps.list as jest.Mock).mockResolvedValue([{ ...apps[0], mode: 'window' }]);
	render(
		<MemoryRouter>
			<AppsPage />
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: 'settings.apps.open' }));

	expect(window.apps.open).toHaveBeenCalledWith('demo-app');
});

it('navigates to app details when the card is clicked', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/apps']}>
			<Routes>
				<Route path="/settings/apps" element={<AppsPage />} />
				<Route path="/settings/apps/:appId" element={<p>App detail</p>} />
			</Routes>
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('link', { name: /Demo App/ }));

	expect(await screen.findByText('App detail')).toBeInTheDocument();
	expect(window.apps.open).not.toHaveBeenCalled();
});

it('treats an app detail route as a child of the apps breadcrumb', async () => {
	const user = userEvent.setup();
	(window.apps.list as jest.Mock).mockResolvedValue([{ ...apps[0], title: 'Kucedr Demo' }]);

	render(
		<MemoryRouter initialEntries={['/settings/apps/demo-app']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="apps">
						<Route index element={<p>Apps list</p>} />
						<Route path=":appId" element={<p>App detail</p>} />
					</Route>
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const breadcrumb = screen.getByRole('navigation', { name: 'settings.breadcrumb.label' });
	expect(await within(breadcrumb).findByText('Kucedr Demo')).toBeInTheDocument();

	await user.click(within(breadcrumb).getByRole('link', { name: 'settings.tabs.apps' }));
	expect(await screen.findByText('Apps list')).toBeInTheDocument();
});

it.each([' DEMO APP ', 'demo app.'])(
	'filters apps by title or description: %s',
	async (query) => {
		const user = userEvent.setup();
		(window.apps.list as jest.Mock).mockResolvedValue([
			...apps,
			{ ...apps[0], id: 'notes', title: 'Notes', handle: '@notes', description: 'Write notes.' },
		]);
		render(
			<MemoryRouter>
				<AppsPage />
			</MemoryRouter>
		);
		await screen.findByText('Notes');
		await user.type(screen.getByRole('searchbox', { name: 'settings.filter.search' }), query);

		expect(screen.getByRole('link', { name: /Demo App/ })).toBeInTheDocument();
		expect(screen.queryByText('Notes')).not.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'settings.filter.clear' }));
		expect(screen.getByText('Notes')).toBeInTheDocument();
		expect(screen.getByRole('searchbox')).toHaveValue('');
	}
);

it('shows a distinct no-results state and restores apps after clearing search', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<AppsPage />
		</MemoryRouter>
	);
	await screen.findByText('Demo App');
	await user.type(screen.getByRole('searchbox', { name: 'settings.filter.search' }), 'missing');

	expect(screen.getByText('settings.filter.empty')).toBeInTheDocument();
	expect(screen.getByText('settings.filter.emptyDescription')).toBeInTheDocument();
	expect(screen.queryByText('settings.apps.empty')).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'settings.filter.clear' }));
	expect(screen.getByText('Demo App')).toBeInTheDocument();
});

it('keeps the installed-app empty state when searching an empty collection', async () => {
	const user = userEvent.setup();
	(window.apps.list as jest.Mock).mockResolvedValue([]);
	render(
		<MemoryRouter>
			<AppsPage />
		</MemoryRouter>
	);
	await screen.findByText('settings.apps.empty');
	await user.type(screen.getByRole('searchbox', { name: 'settings.filter.search' }), 'missing');

	expect(screen.getByText('settings.apps.empty')).toBeInTheDocument();
	expect(screen.queryByText('settings.filter.empty')).not.toBeInTheDocument();
});

it('does not show debug badges or local paths in production', async () => {
	Object.assign(globalThis, { __VITE_ENV__: { DEV: false, PROD: true } });
	(window.apps.list as jest.Mock).mockResolvedValue([debugApp]);
	render(
		<MemoryRouter>
			<AppsPage />
		</MemoryRouter>
	);

	await screen.findByText('Demo App');
	expect(screen.queryByText('settings.apps.debug.badge')).not.toBeInTheDocument();
	expect(screen.queryByText(debugApp.debugPath as string)).not.toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'settings.apps.open' })).toBeInTheDocument();
});
