import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CommandMenu } from '../../../src/renderer/src/experience/CommandMenu';
import en from '../../../resources/i18n/en/main.json';
import italian from '../../../resources/i18n/it/main.json';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string): string =>
			({
				'command.label': 'Route search',
				'command.placeholder': 'Search routes and settings...',
				'command.empty': 'No matching route or setting.',
				'command.suggestions': 'Suggestions',
				'command.settings': 'Settings',
				'command.routes.home.title': 'Home',
				'command.routes.home.description': 'Chat with Kucedr',
				'command.routes.settings.title': 'Settings',
				'command.routes.settings.description': 'Configure Kucedr',
			})[key] ?? key,
	}),
}));

class ResizeObserverMock {
	observe = jest.fn();
	unobserve = jest.fn();
	disconnect = jest.fn();
}

Object.defineProperty(globalThis, 'ResizeObserver', {
	configurable: true,
	value: ResizeObserverMock,
});

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
	configurable: true,
	value: jest.fn(),
});

it.each(['/home', '/home/session/1', '/settings', '/settings/providers/models'])(
	'opens command search on %s',
	(path) => {
		render(
			<MemoryRouter initialEntries={[path]}>
				<CommandMenu />
			</MemoryRouter>
		);

		fireEvent.keyDown(window, { key: 'f', ctrlKey: true });

		expect(screen.getByPlaceholderText('Search routes and settings...')).toBeInTheDocument();
	}
);

it.each(['/start', '/homepage', '/settings-old'])('does not open command search on %s', (path) => {
	render(
		<MemoryRouter initialEntries={[path]}>
			<CommandMenu />
		</MemoryRouter>
	);

	fireEvent.keyDown(window, { key: 'f', ctrlKey: true });

	expect(screen.queryByPlaceholderText('Search routes and settings...')).not.toBeInTheDocument();
});

it('opens General settings with the settings shortcut', () => {
	render(
		<MemoryRouter initialEntries={['/home']}>
			<CommandMenu />
			<Routes>
				<Route path="/home" element={null} />
				<Route path="/settings/general" element={<p>General settings</p>} />
			</Routes>
		</MemoryRouter>
	);

	fireEvent.keyDown(window, { key: ',', metaKey: true });

	expect(screen.getByText('General settings')).toBeInTheDocument();
});

it('groups real routes using the command menu layout', () => {
	render(
		<MemoryRouter initialEntries={['/home']}>
			<CommandMenu open />
		</MemoryRouter>
	);

	expect(screen.getByText('Home')).toBeInTheDocument();
	expect(screen.getByText('Suggestions')).toBeInTheDocument();
	expect(screen.getAllByText('Settings')).toHaveLength(2);
	expect(screen.getByText('/settings/account')).toBeInTheDocument();
});

it('includes every canonical static settings subpage', () => {
	render(
		<MemoryRouter initialEntries={['/home']}>
			<CommandMenu open />
		</MemoryRouter>
	);

	for (const path of [
		'/settings/general/persona',
		'/settings/channels/channelDetail/telegram',
		'/settings/channels/tools',
		'/settings/providers/models',
		'/settings/providers/search',
		'/settings/providers/database',
		'/settings/providers/storage',
		'/settings/voice/history',
		'/settings/voice/tools',
		'/settings/tasks/history',
		'/settings/tasks/tools',
		'/settings/health/tools',
		'/settings/agent/tools',
		'/settings/agent/mcp-tools',
		'/settings/agent/chathistory',
		'/settings/agent/permissions',
	]) {
		expect(screen.getByText(path)).toBeInTheDocument();
	}
});

it('provides complete English and Italian command translations', () => {
	for (const resource of [en, italian]) {
		expect(resource.command).toEqual({
			label: expect.any(String),
			placeholder: expect.any(String),
			empty: expect.any(String),
			suggestions: expect.any(String),
			settings: expect.any(String),
			routes: {
				home: { title: expect.any(String), description: expect.any(String) },
				settings: { title: expect.any(String), description: expect.any(String) },
			},
		});
	}
	expect(italian.command.routes.settings.title).toBe('Impostazioni');
});
