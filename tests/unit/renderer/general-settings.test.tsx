import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GeneralPage from '../../../src/renderer/src/pages/settings/pages/general/Page';


jest.mock('@thilakbhat/heatmap-ui', () => ({
	CalendarHeatmap: ({
		values,
		weeks,
		to,
		cellSize,
		gap,
	}: {
		values: { date: string; value: number }[];
		weeks: number;
		to: string;
		cellSize: number;
		gap: number;
	}) => (
		<div
			data-testid="activity-heatmap"
			data-count={values.length}
			data-to={to}
			data-weeks={weeks}
			data-cell-size={cellSize}
			data-gap={gap}
		/>
	),
}));

const mockSetTheme = jest.fn();
const mockSetKeepAwake = jest.fn();
const mockSetTrayClickAction = jest.fn();
let notifyTrayEnabled: (enabled: boolean) => void;
let notifyKeepAwake: (enabled: boolean) => void;

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

jest.mock('@/contexts', () => ({
	useApp: () => ({
		language: 'en',
		setLanguage: jest.fn(),
		theme: 'system',
		setTheme: mockSetTheme,
	}),
}));

beforeAll(() => {
	Object.defineProperty(globalThis, '__APP_NAME__', { configurable: true, value: 'Kucedr' });
	Object.defineProperty(globalThis, '__APP_VERSION__', { configurable: true, value: '1.0.0' });
});

beforeEach(() => {
	jest.clearAllMocks();
	mockSetKeepAwake.mockResolvedValue(undefined);
	mockSetTrayClickAction.mockResolvedValue(undefined);
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: MouseEvent,
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: {
			getActivity: jest.fn().mockResolvedValue([{ date: '2026-09-23', value: 12 }]),
			getTrayEnabled: jest.fn().mockResolvedValue(true),
			setTrayEnabled: jest.fn().mockResolvedValue(undefined),
			getTrayClickAction: jest.fn().mockResolvedValue('toggle-chat'),
			setTrayClickAction: mockSetTrayClickAction,
			onTrayEnabledChanged: jest.fn((callback) => {
				notifyTrayEnabled = callback;
				return jest.fn();
			}),
			getKeepAwake: jest.fn().mockResolvedValue(false),
			setKeepAwake: mockSetKeepAwake,
			onKeepAwakeChanged: jest.fn((callback) => {
				notifyKeepAwake = callback;
				return jest.fn();
			}),
		},
	});
});

it('enables keep awake from General settings', async () => {
	const user = userEvent.setup();
	await act(async () => {
		render(
			<MemoryRouter>
				<GeneralPage />
			</MemoryRouter>
		);
	});
	const keepAwake = await screen.findByRole('switch', {
		name: 'settings.application.keepAwake',
		checked: false,
	});

	await act(async () => {
		await user.click(keepAwake);
	});

	expect(mockSetKeepAwake).toHaveBeenCalledWith(true);
	expect(keepAwake).toBeChecked();
});

it('saves the configured tray icon click action from General settings', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<GeneralPage />
		</MemoryRouter>
	);

	const trayClickAction = await screen.findByRole('combobox', {
		name: 'settings.application.trayClickAction.title',
	});
	await user.click(trayClickAction);
	await user.click(
		await screen.findByRole('option', {
			name: 'settings.application.trayClickAction.voiceAgent',
		})
	);

	expect(mockSetTrayClickAction).toHaveBeenCalledWith('toggle-persona');
});

it('refreshes toggles changed from the native application menu', async () => {
	render(
		<MemoryRouter>
			<GeneralPage />
		</MemoryRouter>
	);

	await screen.findByRole('switch', { name: 'settings.application.menuBar', checked: true });
	act(() => {
		notifyTrayEnabled(false);
		notifyKeepAwake(true);
	});

	expect(
		await screen.findByRole('switch', { name: 'settings.application.menuBar' })
	).not.toBeChecked();
	expect(screen.getByRole('switch', { name: 'settings.application.keepAwake' })).toBeChecked();
});

it('changes the application theme from General settings', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<GeneralPage />
		</MemoryRouter>
	);

	expect(screen.getByRole('button', { name: 'System theme' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await user.click(screen.getByRole('button', { name: 'Dark theme' }));

	expect(mockSetTheme).toHaveBeenCalledWith('dark');
});

it('opens Voice Agent settings from General settings', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/general']}>
			<Routes>
				<Route path="/settings/general" element={<GeneralPage />} />
			<Route path="/settings/general/persona" element={<p>Voice Agent page</p>} />
			</Routes>
		</MemoryRouter>
	);

	await user.click(screen.getByRole('link', { name: /settings\.voiceAgent\.title/ }));

	expect(screen.getByText('Voice Agent page')).toBeInTheDocument();
});

it('shows activity loaded from application logs in General settings', async () => {
	render(
		<MemoryRouter>
			<GeneralPage />
		</MemoryRouter>
	);

	await waitFor(() => {
		expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-count', '1');
	});
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute(
		'data-to',
		`${new Date().getUTCFullYear()}-12-31`
	);
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-weeks', '53');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-cell-size', '9');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-gap', '1');
	expect(screen.queryByText('settings.activity.empty')).not.toBeInTheDocument();
});
