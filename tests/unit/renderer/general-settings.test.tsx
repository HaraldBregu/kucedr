import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GeneralPage from '../../../src/renderer/src/pages/settings/pages/general/Page';

const mockSetTheme = jest.fn();
const mockSetKeepAwake = jest.fn();
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
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: MouseEvent,
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: {
			getTrayEnabled: jest.fn().mockResolvedValue(true),
			setTrayEnabled: jest.fn().mockResolvedValue(undefined),
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

	expect(await screen.findByRole('switch', { name: 'settings.application.menuBar' })).not.toBeChecked();
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

it('opens Persona settings from General settings', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/general']}>
			<Routes>
				<Route path="/settings/general" element={<GeneralPage />} />
				<Route path="/settings/general/persona" element={<p>Persona page</p>} />
			</Routes>
		</MemoryRouter>
	);

	await user.click(screen.getByRole('link', { name: 'settings.persona.title' }));

	expect(screen.getByText('Persona page')).toBeInTheDocument();
});
