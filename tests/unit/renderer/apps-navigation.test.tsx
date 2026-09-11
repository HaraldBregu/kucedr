import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../../../src/renderer/src/pages/settings/Layout';
import { SettingsBreadcrumb } from '../../../src/renderer/src/pages/settings/Breadcrumb';
import AppsPage from '../../../src/renderer/src/pages/settings/pages/apps/Page';
import type { App } from '../../../src/shared/installed_app_types';

jest.mock('react-i18next', () => {
	const t = (key: string, values?: Record<string, string>): string =>
		values ? `${key} ${JSON.stringify(values)}` : key;
	return { useTranslation: () => ({ t }) };
});

const apps: App[] = [
	{
		id: 'demo-app',
		title: 'Demo App',
		description: 'A demo app.',
		metadata: {
			version: '1.0.0',
			category: 'Demo',
			entry: 'index.html',
		},
	},
];

beforeEach(() => {
	Object.defineProperty(window, 'apps', {
		configurable: true,
		value: {
			list: jest.fn().mockResolvedValue(apps),
			open: jest.fn(),
			openRoot: jest.fn(),
			delete: jest.fn().mockResolvedValue(undefined),
			import: jest.fn(),
		},
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

it('shows open and an overflow delete action on app cards', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<AppsPage />
		</MemoryRouter>
	);

	await screen.findByText('Demo App');
	expect(screen.getByRole('button', { name: 'settings.apps.open' })).toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'settings.apps.details' })).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: /settings.apps.deleteAction/ }));
	expect(
		await screen.findByRole('menuitem', { name: /settings.apps.deleteAction/ })
	).toBeInTheDocument();
});

it('opens the apps folder from the page header', async () => {
	const user = userEvent.setup();

	render(
		<MemoryRouter initialEntries={['/settings/apps']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="apps" element={<AppsPage />} />
				</Route>
			</Routes>
		</MemoryRouter>
	);

	await user.click(screen.getByRole('button', { name: 'common.moreOptions' }));
	await user.click(screen.getByRole('menuitem', { name: 'settings.apps.openFolder' }));

	expect(window.apps.openRoot).toHaveBeenCalledTimes(1);
});

it.each([false, true])('shows skipped upload reasons with partial success: %s', async (partial) => {
	const user = userEvent.setup();
	(window.apps.import as jest.Mock).mockResolvedValue({
		imported: partial ? apps : [],
		skipped: [
			{
				name: 'workspace',
				sourcePath: '/apps/workspace',
				reason: 'Unable to install app: permission denied',
			},
			{ name: 'notes', sourcePath: '/apps/notes', reason: 'Missing or invalid manifest.' },
		],
	});

	render(
		<MemoryRouter>
			<AppsPage />
		</MemoryRouter>
	);
	await screen.findByText('Demo App');
	await user.click(screen.getByRole('button', { name: 'common.moreOptions' }));
	await user.click(screen.getByRole('menuitem', { name: 'settings.apps.upload' }));

	const alert = await screen.findByRole('alert');
	expect(alert).toHaveTextContent('workspace: Unable to install app: permission denied');
	expect(alert).toHaveTextContent('notes: Missing or invalid manifest.');
	if (partial) {
		expect(screen.getByText(/settings.apps.uploaded/)).toBeInTheDocument();
		expect(window.apps.list).toHaveBeenCalledTimes(2);
	} else {
		expect(screen.queryByText(/settings.apps.uploaded/)).not.toBeInTheDocument();
	}
});

it('keeps a canceled upload quiet', async () => {
	const user = userEvent.setup();
	(window.apps.import as jest.Mock).mockResolvedValue(undefined);
	render(
		<MemoryRouter>
			<AppsPage />
		</MemoryRouter>
	);
	await screen.findByText('Demo App');
	await user.click(screen.getByRole('button', { name: 'common.moreOptions' }));
	await user.click(screen.getByRole('menuitem', { name: 'settings.apps.upload' }));

	expect(window.apps.import).toHaveBeenCalledTimes(1);
	expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	expect(screen.queryByText(/settings.apps.uploaded/)).not.toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'common.moreOptions' })).toBeEnabled();
});

it('opens an app from its card action', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<AppsPage />
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: 'settings.apps.open' }));

	expect(window.apps.open).toHaveBeenCalledWith('demo-app');
});

it('navigates to an app detail when its card is clicked', async () => {
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

it('does not navigate to app detail when an overflow action is clicked', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/apps']}>
			<Routes>
				<Route path="/settings/apps" element={<AppsPage />} />
				<Route path="/settings/apps/:appId" element={<p>App detail</p>} />
			</Routes>
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: /settings.apps.deleteAction/ }));
	await user.click(await screen.findByRole('menuitem', { name: /settings.apps.deleteAction/ }));

	expect(window.apps.delete).toHaveBeenCalledWith('demo-app');
	expect(screen.queryByText('App detail')).not.toBeInTheDocument();
});

it('treats an app detail route as a child of the apps breadcrumb', async () => {
	const user = userEvent.setup();
	(window.apps.list as jest.Mock).mockResolvedValue([{ ...apps[0], title: 'Kucedr Demo' }]);

	render(
		<MemoryRouter initialEntries={['/settings/apps/demo-app']}>
			<SettingsBreadcrumb />
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
