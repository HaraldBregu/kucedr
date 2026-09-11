import { act, render, screen } from '@testing-library/react';
import { AppShell } from '../../../src/renderer/src/components/app/titlebar/AppShell';

jest.mock('../../../src/renderer/src/components/app/titlebar/hooks/useAppTheme', () => ({
	useAppTheme: jest.fn(),
}));

jest.mock('../../../src/renderer/src/components/app/titlebar/AppTitleBar', () => ({
	AppTitleBar: ({
		title,
		leftButtons,
		rightButtons,
		sidebarOpen,
		sidebarTransitionDelay,
		sidebarWidth,
	}: {
		title: string;
		leftButtons: Array<{ id: string }>;
		rightButtons: Array<{ id: string }>;
		sidebarOpen?: boolean;
		sidebarTransitionDelay?: number;
		sidebarWidth: number | null;
	}) => (
		<div
			data-sidebar-width={sidebarWidth ?? ''}
			data-left-buttons={leftButtons.map((button) => button.id).join(',')}
			data-right-buttons={rightButtons.map((button) => button.id).join(',')}
			data-sidebar-open={sidebarOpen}
			data-sidebar-transition-delay={sidebarTransitionDelay}
			data-testid="app-titlebar"
		>
			{title}
		</div>
	),
}));

let sidebarWidthChanged: (width: number | null) => void;
let titlebarOptionsChanged: (options: {
	title?: string;
	leftButtons?: Array<{ id: string }>;
	rightButtons?: Array<{ id: string }>;
	sidebarOpen?: boolean;
	sidebarTransitionStartedAt?: number;
	sidebarWidth?: number | null;
} | null) => void;
const stopOptions = jest.fn();
const stopSidebarWidth = jest.fn();

beforeEach(() => {
	stopOptions.mockClear();
	stopSidebarWidth.mockClear();
	Object.defineProperty(window, 'win', {
		configurable: true,
		value: {
			onTitlebarSidebarWidthChanged: jest.fn((callback) => {
				sidebarWidthChanged = callback;
				return stopSidebarWidth;
			}),
			onTitlebarOptionsChanged: jest.fn((callback) => {
				titlebarOptionsChanged = callback;
				return stopOptions;
			}),
		},
	});
});

it('paints the app titlebar over the main translucent window surface', () => {
	render(<AppShell title="Workspace" />);

	const shell = screen.getByTestId('app-titlebar').parentElement;
	expect(shell).toHaveClass(
		'app-translucent-window',
		'h-full',
		'overflow-hidden',
		'bg-background',
		'text-foreground'
	);
	expect(shell).toHaveTextContent('Workspace');
});

it('keeps the app titlebar aligned with its sidebar width', () => {
	render(<AppShell title="Workspace" />);

	act(() => sidebarWidthChanged(240));

	expect(screen.getByTestId('app-titlebar')).toHaveAttribute('data-sidebar-width', '240');
});

it('renders the app title, buttons, and animated sidebar width from one snapshot', () => {
	jest.spyOn(Date, 'now').mockReturnValue(1_040);
	render(<AppShell title="Manifest title" />);

	act(() =>
		titlebarOptionsChanged({
			title: 'Workspace',
			leftButtons: [{ id: 'toggle-sidebar' }],
			rightButtons: [{ id: 'settings' }],
			sidebarOpen: false,
			sidebarTransitionStartedAt: 1_000,
			sidebarWidth: 240,
		})
	);

	const titlebar = screen.getByTestId('app-titlebar');
	expect(titlebar).toHaveTextContent('Workspace');
	expect(titlebar).toHaveAttribute('data-left-buttons', 'toggle-sidebar');
	expect(titlebar).toHaveAttribute('data-right-buttons', 'settings');
	expect(titlebar).toHaveAttribute('data-sidebar-open', 'false');
	expect(titlebar).toHaveAttribute('data-sidebar-transition-delay', '-45');
	expect(titlebar).toHaveAttribute('data-sidebar-width', '240');
	jest.restoreAllMocks();
});

it('restores manifest defaults and unsubscribes when the shell unmounts', () => {
	const { unmount } = render(<AppShell title="Manifest title" />);

	act(() => titlebarOptionsChanged({ title: 'Configured title' }));
	act(() => titlebarOptionsChanged(null));
	expect(screen.getByTestId('app-titlebar')).toHaveTextContent('Manifest title');

	unmount();
	expect(stopOptions).toHaveBeenCalledTimes(1);
	expect(stopSidebarWidth).toHaveBeenCalledTimes(1);
});
