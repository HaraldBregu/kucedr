import { act, render, screen } from '@testing-library/react';
import { AppShell } from '../../../src/renderer/src/components/app/navigationbar/AppShell';

jest.mock('../../../src/renderer/src/components/app/navigationbar/hooks/useAppTheme', () => ({
	useAppTheme: jest.fn(),
}));

jest.mock('../../../src/renderer/src/components/app/navigationbar/AppNavigationBar', () => ({
	AppNavigationBar: ({
		leftButtons,
		rightButtons,
	}: {
		leftButtons?: Array<{ id: string }>;
		rightButtons?: Array<{ id: string }>;
	}) => (
		<div
			data-testid="app-navigationbar"
			data-left-buttons={leftButtons?.map((button) => button.id).join(',') ?? ''}
			data-right-buttons={rightButtons?.map((button) => button.id).join(',') ?? ''}
		/>
	),
}));

let navigationBarOptionsChanged: (options: {
	leftButtons?: Array<{ id: string }>;
	rightButtons?: Array<{ id: string }>;
} | null) => void;
const stopOptions = jest.fn();

beforeEach(() => {
	stopOptions.mockClear();
	Object.defineProperty(window, 'win', {
		configurable: true,
		value: {
			onNavigationBarOptionsChanged: jest.fn((callback) => {
				navigationBarOptionsChanged = callback;
				return stopOptions;
			}),
		},
	});
});

it('renders the shared titleless navigation bar over the app window', () => {
	render(<AppShell />);

	const shell = screen.getByTestId('app-navigationbar').parentElement;
	expect(shell).toHaveClass(
		'app-translucent-window',
		'h-full',
		'overflow-hidden',
		'bg-background',
		'text-foreground'
	);
	expect(shell).not.toHaveTextContent('Workspace');
});

it('renders app buttons from the navigation bar snapshot and unsubscribes', () => {
	const { unmount } = render(<AppShell />);

	act(() =>
		navigationBarOptionsChanged({
			leftButtons: [{ id: 'toggle-sidebar' }],
			rightButtons: [{ id: 'settings' }],
		})
	);

	expect(screen.getByTestId('app-navigationbar')).toHaveAttribute(
		'data-left-buttons',
		'toggle-sidebar'
	);
	expect(screen.getByTestId('app-navigationbar')).toHaveAttribute(
		'data-right-buttons',
		'settings'
	);

	unmount();
	expect(stopOptions).toHaveBeenCalledTimes(1);
});
