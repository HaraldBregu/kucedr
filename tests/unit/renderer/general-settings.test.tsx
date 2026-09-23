import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GeneralPage from '../../../src/renderer/src/pages/settings/pages/general/Page';


jest.mock('@thilakbhat/heatmap-ui', () => ({
	CalendarHeatmap: ({
		values,
		weeks,
		to,
		cellLabel,
		shape,
		scale,
		emptyColor,
		colors,
		'data-heatmap-theme': heatmapTheme,
	}: {
		values: { date: string; value: number }[];
		weeks: number;
		to: string;
		cellLabel: (day: { date: string; value: number }) => string;
		shape: string;
		scale: string;
		emptyColor: string;
		colors: string[];
		'data-heatmap-theme'?: string;
	}) => (
		<div
			data-testid="activity-heatmap"
			data-count={values.length}
			data-to={to}
			data-weeks={weeks}
			data-shape={shape}
			data-scale={scale}
			data-empty-color={emptyColor}
			data-colors={colors.join(',')}
			data-heatmap-theme={heatmapTheme}
		>
			{values.map((day) => (
				<div
					key={day.date}
					className="heatmap__cell-slot"
					role="img"
					aria-label={cellLabel(day)}
				/>
			))}
		</div>
	),
}));

const mockSetTheme = jest.fn();
const mockSetKeepAwake = jest.fn();
const mockSetTrayClickAction = jest.fn();
let appTheme = 'system';
let notifyTrayEnabled: (enabled: boolean) => void;
let notifyKeepAwake: (enabled: boolean) => void;

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

jest.mock('@/contexts', () => ({
	useApp: () => ({
		language: 'en',
		setLanguage: jest.fn(),
		theme: appTheme,
		setTheme: mockSetTheme,
	}),
}));

beforeAll(() => {
	Object.defineProperty(globalThis, '__APP_NAME__', { configurable: true, value: 'Kucedr' });
	Object.defineProperty(globalThis, '__APP_VERSION__', { configurable: true, value: '1.0.0' });
});

beforeEach(() => {
	jest.clearAllMocks();
	appTheme = 'system';
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
	expect(screen.getByTestId('activity-scroll')).toHaveClass('card-body');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute(
		'data-to',
		new Date().toISOString().slice(0, 10)
	);
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-weeks', '35');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-shape', 'rounded');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-scale', 'log');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute(
		'data-empty-color',
		'var(--activity-empty-color)'
	);
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute(
		'data-colors',
		'var(--activity-color-1),var(--activity-color-2),var(--activity-color-3),var(--activity-color-4)'
	);
	expect(screen.queryByText('settings.activity.empty')).not.toBeInTheDocument();

	const cell = screen.getByRole('img', { name: 'settings.activity.day' });
	fireEvent.pointerMove(cell, { clientX: 160, clientY: 120 });
	const tooltip = screen.getByRole('tooltip');
	expect(tooltip).toHaveClass('fixed');
	expect(screen.getByTestId('activity-scroll')).not.toContainElement(tooltip);
});

it('pins the heatmap to the light theme when selected', async () => {
	appTheme = 'light';
	await act(async () => {
		render(
			<MemoryRouter>
				<GeneralPage />
			</MemoryRouter>
		);
	});

	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-heatmap-theme', 'light');
});
