const buildFromTemplate = jest.fn((template: unknown) => template);

jest.mock('electron', () => ({
	app: { isPackaged: false, getAppPath: jest.fn(() => process.cwd()) },
	Tray: class {
		on = jest.fn();
		setToolTip = jest.fn();
		popUpContextMenu = jest.fn();
		destroy = jest.fn();
	},
	Menu: { buildFromTemplate },
	nativeImage: { createFromPath: jest.fn(() => ({ resize: jest.fn(() => ({})) })) },
}));

jest.mock('../../../../src/main/i18n', () => ({
	loadTranslations: () => ({
		showKucedr: 'Show Kucedr',
		hideKucedr: 'Hide Kucedr',
		startPersona: 'Start Persona',
		hidePersona: 'Hide Persona',
		showPersona: 'Show Persona',
		apps: 'Apps',
		microphone: 'Microphone',
		microphoneDefault: 'System default',
		noApps: 'No apps',
		quit: 'Quit',
	}),
}));

import { Tray } from '../../../../src/main/tray';

type MenuEntry = {
	label?: string;
	checked?: boolean;
	type?: string;
	submenu?: MenuEntry[];
	click?: () => void;
};

it('lists microphone inputs and checks the persisted selection', async () => {
	let selected = 'usb';
	const tray = new Tray({
		onToggleApp: jest.fn(),
		onStartPersona: jest.fn(),
		onHidePersona: jest.fn(),
		onShowPersona: jest.fn(),
		onQuit: jest.fn(),
		isAppVisible: () => false,
		isPersonaActive: () => false,
		isPersonaVisible: () => false,
		getApps: () => [],
		onOpenApp: jest.fn(),
		getMicrophoneInputs: async () => [
			{ id: 'built-in', label: 'Built-in microphone' },
			{ id: 'usb', label: 'USB microphone' },
		],
		getMicrophoneInputId: () => selected,
		onMicrophoneInputChange: (inputId) => {
			selected = inputId;
		},
	});

	tray.create();
	await Promise.resolve();
	tray.updateContextMenu();

	const template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	const microphone = template.find((entry) => entry.label === 'Microphone');
	expect(microphone?.submenu?.map((entry) => entry.label)).toEqual([
		'System default',
		'Built-in microphone',
		'USB microphone',
	]);
	expect(microphone?.submenu?.find((entry) => entry.label === 'USB microphone')).toMatchObject({
		checked: true,
		type: 'radio',
	});
	microphone?.submenu?.find((entry) => entry.label === 'System default')?.click?.();
	expect(selected).toBe('default');
});

it('starts, hides, and shows the Persona without ending its conversation', () => {
	let active = false;
	let visible = false;
	const startPersona = jest.fn(() => {
		active = true;
		visible = true;
	});
	const hidePersona = jest.fn(() => {
		visible = false;
	});
	const showPersona = jest.fn(() => {
		visible = true;
	});
	const tray = new Tray({
		onToggleApp: jest.fn(),
		onStartPersona: startPersona,
		onHidePersona: hidePersona,
		onShowPersona: showPersona,
		onQuit: jest.fn(),
		isAppVisible: () => false,
		isPersonaActive: () => active,
		isPersonaVisible: () => visible,
		getApps: () => [],
		onOpenApp: jest.fn(),
	});

	tray.create();
	let template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	let personaItem = template.find((entry) => entry.label === 'Start Persona');
	expect(personaItem).toMatchObject({ enabled: true });
	personaItem?.click?.();

	tray.updateContextMenu();
	template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	personaItem = template.find((entry) => entry.label === 'Hide Persona');
	expect(personaItem).toMatchObject({ enabled: true });
	personaItem?.click?.();

	tray.updateContextMenu();
	template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	personaItem = template.find((entry) => entry.label === 'Show Persona');
	expect(personaItem).toMatchObject({ enabled: true });
	personaItem?.click?.();
	expect(startPersona).toHaveBeenCalledTimes(1);
	expect(hidePersona).toHaveBeenCalledTimes(1);
	expect(showPersona).toHaveBeenCalledTimes(1);
	expect(active).toBe(true);
});
