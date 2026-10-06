import { render, screen, within } from '@testing-library/react';
import { BookOpenText, Library } from 'lucide-react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../../../src/renderer/src/pages/settings/Layout';
import { SettingsPageHeader } from '../../../src/renderer/src/pages/settings/components';
import en from '../../../resources/i18n/en/main.json';
import italian from '../../../resources/i18n/it/main.json';
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

function hasTranslation(resource: object, key: string): boolean {
	let value: unknown = resource;
	for (const part of key.split('.')) {
		if (!value || typeof value !== 'object' || !(part in value)) return false;
		value = (value as Record<string, unknown>)[part];
	}
	return typeof value === 'string' && value.length > 0;
}

it('provides English and Italian translations for every settings navigation item', () => {
	const keys = [
		...SETTINGS_NAVIGATION.flatMap((item) => [
			item.labelKey,
			item.sidebarLabelKey,
			item.descriptionKey,
		]),
		...SETTINGS_DETAIL_ITEMS.flatMap((item) => [item.labelKey, item.descriptionKey]),
		...SETTINGS_MODEL_SERVICE_ITEMS.flatMap((item) => [item.labelKey, item.descriptionKey]),
	].filter((key): key is string => Boolean(key));

	for (const key of keys) {
		expect(hasTranslation(en, key)).toBe(true);
		expect(hasTranslation(italian, key)).toBe(true);
	}
});

it('places Memory and Knowledge in the Brain sidebar section below Agents', () => {
	render(
		<MemoryRouter initialEntries={['/settings/memory']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="*" element={null} />
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const navigation = screen.getByRole('navigation', { name: 'settings.title' });
	const agents = within(navigation)
		.getByText('settings.overview.groups.assistant')
		.closest('[data-slot="split-pane-group"]');
	const brain = within(navigation)
		.getByText('settings.overview.groups.brain')
		.closest('[data-slot="split-pane-group"]');
	const links = within(brain as HTMLElement).getAllByRole('link');

	expect(brain?.previousElementSibling).toBe(agents);
	expect(links.map((link) => link.getAttribute('href'))).toEqual([
		'/settings/memory',
		'/settings/knowledge',
	]);
	expect(within(agents as HTMLElement).queryByRole('link', { name: 'settings.memory.title' })).not.toBeInTheDocument();
	expect(within(agents as HTMLElement).queryByRole('link', { name: 'settings.knowledge.title' })).not.toBeInTheDocument();
});

it('does not expose Coding in settings navigation', () => {
	expect(SETTINGS_MODEL_SERVICE_ITEMS).not.toContainEqual(
		expect.objectContaining({ path: '/settings/coding' })
	);
});

it('uses distinct icons for Library and Knowledge', () => {
	expect(SETTINGS_NAVIGATION.find((item) => item.path === '/settings/library')?.icon).toBe(Library);
	expect(SETTINGS_NAVIGATION.find((item) => item.path === '/settings/knowledge')?.icon).toBe(
		BookOpenText
	);
});

it('places Library and Workspace below Providers without Code in the general sidebar group', () => {
	render(
		<MemoryRouter initialEntries={['/settings/settings']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="*" element={null} />
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const navigation = screen.getByRole('navigation', { name: 'settings.title' });
	const providers = within(navigation).getByRole('link', { name: 'settings.tabs.providers' });
	const library = within(navigation).getByRole('link', { name: 'library.title' });
	const group = providers.closest('[data-slot="split-pane-group"]');
	const links = within(group as HTMLElement).getAllByRole('link');

	expect(library.closest('[data-slot="split-pane-group"]')).toBe(group);
	expect(links.indexOf(library)).toBe(links.indexOf(providers) + 1);
	const workspace = within(group as HTMLElement).getByRole('link', { name: 'settings.workspace.title' });
	expect(workspace).toHaveAttribute('href', '/settings/workspace');
	expect(links.indexOf(workspace)).toBe(links.indexOf(library) + 1);
	expect(within(navigation).queryByRole('button', { name: /navigationBar.code/ })).not.toBeInTheDocument();
});

it.each([
	['/settings/knowledge', 'settings.knowledge.title'],
	['/settings/agent/tools', 'settings.modelServices.tools'],
	['/settings/agent/mcp-tools', 'settings.modelServices.agentTools.mcp.title'],
	['/settings/voice', 'settings.tabs.voice'],
	['/settings/settings/persona', 'settings.voiceAgent.title'],
	['/settings/tasks', 'settings.tabs.taskScheduler'],
	['/settings/skills', 'settings.tabs.skills'],
	['/settings/mcp', 'settings.tabs.mcp'],
	['/settings/providers', 'settings.tabs.providers'],
	['/settings/providers/database', 'settings.tabs.databases'],
	['/settings/providers/storage', 'settings.tabs.storage'],
	['/settings/agent/permissions', 'settings.tabs.permissions'],
	['/settings/plugins', 'settings.tabs.plugins'],
])('uses the canonical %s route and breadcrumb', (path, labelKey) => {
	if (
		path === '/settings/settings/persona' ||
		path === '/settings/agent/tools' ||
		path === '/settings/agent/mcp-tools'
	) {
		expect(SETTINGS_DETAIL_ITEMS).toContainEqual(expect.objectContaining({ path, labelKey }));
	} else if (path.startsWith('/settings/providers/')) {
		expect(SETTINGS_NAVIGATION).toContainEqual(
			expect.objectContaining({ path: '/settings/providers', labelKey: 'settings.tabs.providers' })
		);
	} else {
		expect(SETTINGS_NAVIGATION).toContainEqual(expect.objectContaining({ path, labelKey }));
	}

	render(
		<MemoryRouter initialEntries={[path]}>
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
			within(breadcrumb).getByRole('link', { name: 'settings.modelServices.chatName' })
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
		name: 'settings.modelServices.chatName',
	});
	const generalGroup = within(navigation)
		.getByRole('link', { name: 'settings.tabs.account' })
		.closest('[data-slot="split-pane-group"]');
	const assistantGroup = within(navigation)
		.getByText('settings.overview.groups.assistant')
		.closest('[data-slot="split-pane-group"]');
	const providersLink = within(generalGroup as HTMLElement).getByRole('link', {
		name: 'settings.tabs.providers',
	});

	expect(sidebar).toBeInTheDocument();
	expect(workspace).toBeInTheDocument();
	expect(pageContainer).toHaveClass('pb-6');
	expect(pageContainer).not.toHaveClass('pt-6', 'py-6');
	expect(screen.getByRole('heading', { name: 'Settings page' })).toHaveClass('text-lg');
	expect(returnToChat).toHaveAttribute('href', '/home');
	expect(within(sidebar as HTMLElement).getAllByRole('link')[0]).toBe(returnToChat);
	expect(
		within(workspace as HTMLElement).getByRole('navigation', {
			name: 'settings.breadcrumb.label',
		})
	).toBeInTheDocument();
	expect(screen.getByRole('separator', { name: 'Resize sidebar' })).toBeInTheDocument();
	expect(
		within(navigation).queryByRole('link', { name: 'settings.title' })
	).not.toBeInTheDocument();
	expect(assistantGroup).not.toBeNull();
	expect(generalGroup).not.toBeNull();
	expect(SETTINGS_NAVIGATION).not.toContainEqual(
		expect.objectContaining({ path: '/settings/agent/models' })
	);
	expect(
		within(navigation).queryByRole('link', { name: 'settings.overview.groups.mlModels' })
	).not.toBeInTheDocument();
	expect(
		within(assistantGroup as HTMLElement).queryByRole('link', { name: 'settings.tabs.skills' })
	).not.toBeInTheDocument();
	expect(
		within(assistantGroup as HTMLElement).queryByRole('link', { name: 'settings.coding.title' })
	).not.toBeInTheDocument();
	expect(providersLink).toHaveAttribute('href', '/settings/providers');
	const generalLinks = within(generalGroup as HTMLElement).getAllByRole('link');
	const storage = within(generalGroup as HTMLElement).getByRole('link', {
		name: 'settings.tabs.storage',
	});
	expect(generalLinks.indexOf(providersLink)).toBe(generalLinks.indexOf(storage) + 1);
	for (const path of [
		'/settings/providers/models',
		'/settings/providers/search',
		'/settings/providers/database',
		'/settings/providers/storage',
	]) {
		expect(generalLinks.some((link) => link.getAttribute('href') === path)).toBe(false);
	}
	expect(
		within(assistantGroup as HTMLElement).getByRole('link', { name: 'settings.tabs.skills' })
	).toHaveAttribute('href', '/settings/skills');
	expect(
		within(assistantGroup as HTMLElement).getByRole('link', { name: 'settings.sidebar.mcp' })
	).toHaveAttribute('href', '/settings/mcp');
	expect(
		within(assistantGroup as HTMLElement).getByRole('link', {
			name: 'settings.tabs.voice',
		})
	).toHaveAttribute('href', '/settings/voice');
	expect(
		within(assistantGroup as HTMLElement).getByRole('link', { name: 'settings.tabs.taskScheduler' })
	).toHaveAttribute('href', '/settings/tasks');
	expect(
		within(assistantGroup as HTMLElement).getByRole('link', { name: 'settings.tabs.health' })
	).toHaveAttribute('href', '/settings/health');
	expect(
		within(navigation).queryByRole('link', { name: 'settings.tabs.permissions' })
	).not.toBeInTheDocument();
	expect(
		within(navigation)
			.getByRole('link', { name: 'settings.tabs.plugins' })
			.closest('[data-slot="split-pane-group"]')
	).toBe(
		within(navigation)
			.getByRole('link', { name: 'settings.tabs.apps' })
			.closest('[data-slot="split-pane-group"]')
	);
	expect(currentSection).toHaveAttribute('data-active');
});

it('keeps Plugins and Apps in the main sidebar list without a footer', () => {
	render(
		<MemoryRouter initialEntries={['/settings/plugins']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="*" element={<p>Settings page</p>} />
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const navigation = screen.getByRole('navigation', { name: 'settings.title' });
	const list = navigation.querySelector('.overflow-y-auto');
	const plugins = within(list as HTMLElement).getByRole('link', { name: 'settings.tabs.plugins' });
	const extensionsGroup = plugins.closest('[data-slot="split-pane-group"]');
	expect(list).not.toBeNull();
	expect(extensionsGroup).not.toBeNull();
	expect(navigation.querySelector('[data-slot="sidebar-footer"]')).not.toBeInTheDocument();
	expect(
		within(list as HTMLElement).queryByText('settings.overview.groups.extensions')
	).not.toBeInTheDocument();
	expect(plugins).toHaveAttribute('aria-current', 'page');
	expect(
		within(list as HTMLElement).getByRole('link', { name: 'settings.tabs.apps' })
	).toHaveAttribute('href', '/settings/apps');
	expect(
		within(extensionsGroup as HTMLElement).queryByRole('link', { name: 'settings.tabs.mcp' })
	).not.toBeInTheDocument();
});

it('uses the Chat icon for the Agent Chat sidebar item', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/settings/agent']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="*" element={<p>Settings page</p>} />
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const sidebar = container.querySelector('[data-slot="split-pane-sidebar"]');
	const navigation = within(sidebar as HTMLElement).getByRole('navigation', {
		name: 'settings.title',
	});
	const chat = within(navigation).getByRole('link', {
		name: 'settings.modelServices.chatName',
	});

	expect(chat.querySelector('.lucide-message-circle')).toBeInTheDocument();
});

it('uses the audio waveform icon for Voice', () => {
	const { container } = render(
		<MemoryRouter initialEntries={['/settings/voice']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="*" element={<p>Settings page</p>} />
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const sidebar = container.querySelector('[data-slot="split-pane-sidebar"]');
	const voice = within(sidebar as HTMLElement).getByRole('link', {
		name: 'settings.tabs.voice',
	});

	expect(voice.querySelector('.lucide-audio-lines')).toBeInTheDocument();
});

it('places Channels below Apps and Remote Agents below Channels outside the Agents group', () => {
	render(
		<MemoryRouter initialEntries={['/settings/health']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="*" element={<SettingsPageHeader title="Settings page" />} />
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const navigation = screen.getByRole('navigation', { name: 'settings.title' });
	const assistantGroup = within(navigation)
		.getByText('settings.overview.groups.assistant')
		.closest('[data-slot="split-pane-group"]');
	const links = within(assistantGroup as HTMLElement).getAllByRole('link');
	const voice = within(assistantGroup as HTMLElement).getByRole('link', {
		name: 'settings.tabs.voice',
	});
	const health = within(assistantGroup as HTMLElement).getByRole('link', {
		name: 'settings.tabs.health',
	});
	const remoteAgent = within(navigation).getByRole('link', {
		name: 'settings.tabs.remoteAgent new',
	});
	const apps = within(navigation).getByRole('link', { name: 'settings.tabs.apps' });
	const channels = within(navigation).getByRole('link', { name: 'settings.tabs.channels' });
	const extensionsGroup = apps.closest('[data-slot="split-pane-group"]');
	const extensionLinks = within(extensionsGroup as HTMLElement).getAllByRole('link');

	expect(within(extensionsGroup as HTMLElement).getByText('settings.overview.groups.extensions')).toBeInTheDocument();
	expect(channels).toHaveAttribute('href', '/settings/channels');
	expect(channels.closest('[data-slot="split-pane-group"]')).toBe(extensionsGroup);
	expect(extensionLinks.indexOf(channels)).toBe(extensionLinks.indexOf(apps) + 1);
	expect(remoteAgent.closest('[data-slot="split-pane-group"]')).toBe(extensionsGroup);
	expect(extensionLinks.indexOf(remoteAgent)).toBe(extensionLinks.indexOf(channels) + 1);
	expect(
		within(assistantGroup as HTMLElement).queryByRole('link', {
			name: 'settings.tabs.channels',
		})
	).not.toBeInTheDocument();
	expect(remoteAgent).toHaveAttribute('href', '/settings/remote-agent');
	expect(remoteAgent.querySelector('.lucide-network')).toBeInTheDocument();
	expect(within(remoteAgent).getByText('new')).toHaveAttribute('data-slot', 'badge');
	expect(links.indexOf(health)).toBe(links.indexOf(voice) + 1);
	expect(within(assistantGroup as HTMLElement).queryByRole('link', { name: 'settings.tabs.remoteAgent new' })).not.toBeInTheDocument();
});

it('places Providers directly after Storage without provider subpages in the sidebar', () => {
	render(
		<MemoryRouter initialEntries={['/settings/providers']}>
			<Routes>
				<Route path="/settings" element={<Layout />}>
					<Route path="*" element={<SettingsPageHeader title="Settings page" />} />
				</Route>
			</Routes>
		</MemoryRouter>
	);

	const navigation = screen.getByRole('navigation', { name: 'settings.title' });
	const storage = within(navigation).getByRole('link', { name: 'settings.tabs.storage' });
	expect(storage).toHaveAttribute('href', '/settings/storage');
	const group = storage.closest('[data-slot="split-pane-group"]');
	const links = within(group as HTMLElement).getAllByRole('link');
	const providers = within(group as HTMLElement).getByRole('link', {
		name: 'settings.tabs.providers',
	});

	expect(providers).toHaveAttribute('href', '/settings/providers');
	expect(links.indexOf(providers)).toBe(links.indexOf(storage) + 1);
	for (const path of [
		'/settings/providers/models',
		'/settings/providers/search',
		'/settings/providers/database',
		'/settings/providers/storage',
	]) {
		expect(links.some((link) => link.getAttribute('href') === path)).toBe(false);
	}
});
