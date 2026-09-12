import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../../../src/renderer/src/pages/settings/Layout';
import { SettingsBreadcrumb } from '../../../src/renderer/src/pages/settings/Breadcrumb';
import { SettingsPageHeader } from '../../../src/renderer/src/pages/settings/components';
import {
	SETTINGS_DETAIL_ITEMS,
	SETTINGS_MODEL_SERVICE_ITEMS,
	SETTINGS_NAVIGATION,
} from '../../../src/renderer/src/pages/settings/navigation';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

beforeEach(() => {
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

it.each([
	['/settings/agent/rag', 'settings.rag.title'],
	['/settings/agent/tools', 'settings.modelServices.tools'],
	['/settings/general/persona', 'settings.voiceAgent.title'],
	['/settings/agent/tasks', 'settings.tabs.taskScheduler'],
	['/settings/agent/skills', 'settings.tabs.skills'],
	['/settings/agent/mcp', 'settings.tabs.mcp'],
	['/settings/coding', 'settings.coding.title'],
	['/settings/providers/database', 'settings.tabs.databases'],
	['/settings/providers/storage', 'settings.tabs.storage'],
	['/settings/agent/permissions', 'settings.tabs.permissions'],
])('uses the canonical %s route and breadcrumb', (path, labelKey) => {
	if (path === '/settings/general/persona' || path === '/settings/agent/tools') {
		expect(SETTINGS_DETAIL_ITEMS).toContainEqual(expect.objectContaining({ path, labelKey }));
	} else if (path === '/settings/coding') {
		expect(SETTINGS_MODEL_SERVICE_ITEMS).toContainEqual(
			expect.objectContaining({ path, labelKey })
		);
	} else {
		expect(SETTINGS_NAVIGATION).toContainEqual(expect.objectContaining({ path, labelKey }));
	}

	render(
		<MemoryRouter initialEntries={[path]}>
			<SettingsBreadcrumb />
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="*" element={<p>Settings page</p>} />
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const breadcrumb = screen.getByRole('navigation', { name: 'settings.breadcrumb.label' });
	expect(within(breadcrumb).getByText(labelKey)).toBeInTheDocument();
	if (path.startsWith('/settings/agent/')) {
		expect(
			within(breadcrumb).getByRole('link', { name: 'settings.modelServices.assistantName' })
		).toHaveAttribute('href', '/settings/agent');
	}
});

it('renders settings navigation beside the workspace and marks the current section', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/settings/agent/chathistory']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="*" element={<SettingsPageHeader title="Settings page" />} />
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const sidebar = container.querySelector('[data-slot="split-pane-sidebar"]');
	const workspace = container.querySelector('[data-slot="settings-workspace"]');
	const pageContainer = workspace?.firstElementChild;
	const returnToChat = within(sidebar as HTMLElement).getByRole('link', {
		name: 'settings.returnToChat',
	});
	const navigation = screen.getByRole('navigation', { name: 'settings.title' });
	const currentSection = within(navigation).getByRole('link', {
		name: 'settings.modelServices.assistantName',
	});
	const assistantGroup = within(navigation)
		.getByText('settings.overview.groups.assistant')
		.closest('[data-slot="split-pane-group"]');
	const providersGroup = within(navigation)
		.getByText('settings.tabs.providers')
		.closest('[data-slot="split-pane-group"]');

	expect(sidebar).toBeInTheDocument();
	expect(workspace).toBeInTheDocument();
	expect(pageContainer).toHaveClass('pb-6');
	expect(pageContainer).not.toHaveClass('pt-6', 'py-6');
	expect(screen.getByRole('heading', { name: 'Settings page' })).toHaveClass('text-lg');
	expect(returnToChat).toHaveAttribute('href', '/home');
	expect(within(sidebar as HTMLElement).getAllByRole('link')[0]).toBe(returnToChat);
	expect(
		within(workspace as HTMLElement).queryByRole('navigation', {
			name: 'settings.breadcrumb.label',
		})
	).not.toBeInTheDocument();
	expect(screen.getByRole('separator', { name: 'Resize sidebar' })).toBeInTheDocument();
	expect(
		within(navigation).queryByRole('link', { name: 'settings.title' })
	).not.toBeInTheDocument();
	expect(assistantGroup).not.toBeNull();
	expect(providersGroup).not.toBeNull();
	expect(
		within(assistantGroup as HTMLElement).queryByRole('link', { name: 'settings.tabs.skills' })
	).not.toBeInTheDocument();
	expect(
		within(assistantGroup as HTMLElement).getByRole('link', { name: 'settings.coding.title' })
	).toBeInTheDocument();
	expect(
		within(providersGroup as HTMLElement).getByRole('link', {
			name: 'settings.overview.groups.mlModels',
		})
	).toBeInTheDocument();
	expect(
		within(providersGroup as HTMLElement).getByRole('link', {
			name: 'settings.tabs.searchEngines',
		})
	).toBeInTheDocument();
	expect(
		within(providersGroup as HTMLElement).getByRole('link', {
			name: 'settings.tabs.databases',
		})
	).toHaveAttribute('href', '/settings/providers/database');
	expect(
		within(providersGroup as HTMLElement).getByRole('link', {
			name: 'settings.tabs.storage',
		})
	).toHaveAttribute('href', '/settings/providers/storage');
	expect(
		within(assistantGroup as HTMLElement).queryByRole('link', { name: 'settings.tabs.mcp' })
	).not.toBeInTheDocument();
	expect(
		within(navigation).queryByRole('link', { name: 'settings.tabs.taskScheduler' })
	).not.toBeInTheDocument();
	expect(
		within(navigation).queryByRole('link', { name: 'settings.tabs.health' })
	).not.toBeInTheDocument();
	expect(
		within(navigation).queryByRole('link', { name: 'settings.tabs.permissions' })
	).not.toBeInTheDocument();
	expect(
		within(navigation).queryByRole('link', { name: 'settings.rag.title' })
	).not.toBeInTheDocument();
	expect(
		within(navigation)
			.getByRole('link', { name: 'settings.tabs.channels' })
			.closest('[data-slot="split-pane-group"]')
	).toBe(
		within(navigation)
			.getByRole('link', { name: 'settings.tabs.apps' })
			.closest('[data-slot="split-pane-group"]')
	);
	expect(currentSection).toHaveAttribute('data-active');
});
