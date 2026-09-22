import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CommandMenu } from '../../../src/renderer/src/experience/CommandMenu';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string): string => fallback ?? key,
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

it('shows command items in one list without section headings', () => {
	render(
		<MemoryRouter initialEntries={['/home']}>
			<CommandMenu open />
		</MemoryRouter>
	);

	expect(screen.getByText('Home')).toBeInTheDocument();
	expect(screen.getByText('Settings')).toBeInTheDocument();
	expect(screen.queryByText('Routes')).not.toBeInTheDocument();
	expect(screen.queryByText('Settings routes')).not.toBeInTheDocument();
});
