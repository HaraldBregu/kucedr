import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GeneralPage from '../../../src/renderer/src/pages/settings/pages/general/Page';


const mockSetTheme = jest.fn();
const mockSetKeepAwake = jest.fn();
const mockSetTrayClickAction = jest.fn();
const mockSetWindowSize = jest.fn();
const mockSetWindowRadius = jest.fn();
let notifyTrayEnabled: (enabled: boolean) => void;
let notifyKeepAwake: (enabled: boolean) => void;
let notifyWindowRadius: (radius: 8 | 12 | 16 | 20 | 24) => void;

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
	document.documentElement.style.removeProperty('--app-window-radius');
	mockSetKeepAwake.mockResolvedValue(undefined);
	mockSetTrayClickAction.mockResolvedValue(undefined);
	mockSetWindowSize.mockResolvedValue(undefined);
	mockSetWindowRadius.mockResolvedValue(undefined);
	Object.defineProperty(window, 'win', {
		configurable: true,
		value: {
			getSize: jest.fn().mockResolvedValue('900x700'),
			setSize: mockSetWindowSize,
		},
	});
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: MouseEvent,
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: {
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
			getWindowRadius: jest.fn().mockResolvedValue(20),
			setWindowRadius: mockSetWindowRadius,
			onWindowRadiusChanged: jest.fn((callback) => {
				notifyWindowRadius = callback;
				return jest.fn();
			}),
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

it('resizes the window when a size preset is selected', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<GeneralPage />
		</MemoryRouter>
	);

	const size = await screen.findByRole('combobox', {
		name: 'settings.application.windowSize',
	});
	await user.click(size);
	await user.click(await screen.findByRole('option', { name: '1000×700' }));

	expect(mockSetWindowSize).toHaveBeenCalledWith('1000x700');
	expect(size).toHaveTextContent('1000×700');
});

it('selects and refreshes the window radius preset', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<GeneralPage />
		</MemoryRouter>
	);
	const radius = await screen.findByRole('combobox', {
		name: 'settings.application.windowRadius',
	});
	expect(radius).toHaveTextContent('20px');
	await user.click(radius);
	await user.click(await screen.findByRole('option', { name: '8px' }));
	expect(document.documentElement.style.getPropertyValue('--app-window-radius')).toBe('8px');
	await user.click(radius);
	await user.click(await screen.findByRole('option', { name: '24px' }));
	expect(mockSetWindowRadius).toHaveBeenCalledWith(24);
	expect(radius).toHaveTextContent('24px');
	act(() => notifyWindowRadius(12));
	expect(radius).toHaveTextContent('12px');
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
