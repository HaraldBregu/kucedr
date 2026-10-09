import { BrowserWindow, Menu as ElectronMenu } from 'electron';
import { Menu } from '../../../../src/main/menu';

jest.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
jest.mock('../../../../src/main/i18n', () => ({
	loadTranslations: () => ({
		apps: 'Apps',
		view: 'View',
		back: 'Back',
		forward: 'Forward',
		settings: 'Settings',
		soundFeedback: 'Sound feedback',
	}),
}));

type MenuEntry = {
	id?: string;
	label?: string;
	accelerator?: string;
	type?: string;
	checked?: boolean;
	submenu?: MenuEntry[];
	click?: () => void;
};

describe('application menu', () => {
	it.each([true, false])('toggles feedback sounds from a persisted %s value', (initiallyEnabled) => {
		let enabled = initiallyEnabled;
		const onSoundFeedbackEnabledChange = jest.fn((next: boolean) => {
			enabled = next;
		});
		const buildFromTemplate = ElectronMenu.buildFromTemplate as jest.Mock;
		buildFromTemplate.mockImplementation((template: MenuEntry[]) => template);
		new Menu({
			onLanguageChange: jest.fn(),
			onNewWindow: jest.fn(),
			getSoundFeedbackEnabled: () => enabled,
			onSoundFeedbackEnabledChange,
		}).create();

		const template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
		const soundFeedback = template.find((entry) => entry.label === 'Settings')?.submenu
			?.find((entry) => entry.id === 'sound-feedback');
		expect(soundFeedback).toMatchObject({
			label: 'Sound feedback',
			type: 'checkbox',
			checked: initiallyEnabled,
		});
		soundFeedback?.click?.();

		expect(onSoundFeedbackEnabledChange).toHaveBeenCalledWith(!initiallyEnabled);
		const updatedTemplate = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
		expect(updatedTemplate.find((entry) => entry.label === 'Settings')?.submenu
			?.find((entry) => entry.id === 'sound-feedback')?.checked).toBe(!initiallyEnabled);
	});

	it('refreshes the sound feedback checkbox from the shared preference', () => {
		let enabled = true;
		const buildFromTemplate = ElectronMenu.buildFromTemplate as jest.Mock;
		buildFromTemplate.mockImplementation((template: MenuEntry[]) => template);
		const menu = new Menu({
			onLanguageChange: jest.fn(),
			onNewWindow: jest.fn(),
			getSoundFeedbackEnabled: () => enabled,
		});
		menu.create();
		enabled = false;
		menu.create();

		const template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
		expect(template.find((entry) => entry.label === 'Settings')?.submenu
			?.find((entry) => entry.id === 'sound-feedback')?.checked).toBe(false);
	});

	it('keeps the platform new-session shortcut available', () => {
		const onNewWindow = jest.fn();
		const buildFromTemplate = ElectronMenu.buildFromTemplate as jest.Mock;
		buildFromTemplate.mockImplementation((template: MenuEntry[]) => template);
		const menu = new Menu({
			onLanguageChange: jest.fn(),
			onNewWindow,
		});

		menu.create();

		const template = buildFromTemplate.mock.calls[0][0] as MenuEntry[];
		const newWindow = template[process.platform === 'darwin' ? 1 : 0].submenu?.[0];
		expect(newWindow?.accelerator).toBe('CmdOrCtrl+Shift+N');
		newWindow?.click?.();
		expect(onNewWindow).toHaveBeenCalledTimes(1);
	});

	it('provides macOS back and forward navigation shortcuts', () => {
		if (process.platform !== 'darwin') return;

		const goBack = jest.fn();
		const goForward = jest.fn();
		(BrowserWindow.getFocusedWindow as jest.Mock).mockReturnValue({
			webContents: {
				navigationHistory: {
					canGoBack: () => true,
					canGoForward: () => true,
					goBack,
					goForward,
				},
			},
		});
		const buildFromTemplate = ElectronMenu.buildFromTemplate as jest.Mock;
		buildFromTemplate.mockImplementation((template: MenuEntry[]) => template);
		new Menu({
			onLanguageChange: jest.fn(),
			onNewWindow: jest.fn(),
		}).create();

		const template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
		const view = template.find((entry) => entry.label === 'View')?.submenu;
		const back = view?.find((entry) => entry.accelerator === 'Cmd+[');
		const forward = view?.find((entry) => entry.accelerator === 'Cmd+]');
		back?.click?.();
		forward?.click?.();

		expect(back).toBeDefined();
		expect(forward).toBeDefined();
		expect(goBack).toHaveBeenCalledTimes(1);
		expect(goForward).toHaveBeenCalledTimes(1);
	});
});
