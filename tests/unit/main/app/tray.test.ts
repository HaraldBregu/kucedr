const buildFromTemplate = jest.fn((template: unknown) => template);
const trayOn = jest.fn();

jest.mock('electron', () => ({
	app: { isPackaged: false, getAppPath: jest.fn(() => process.cwd()) },
	Tray: class {
		on = trayOn;
		setToolTip = jest.fn();
		popUpContextMenu = jest.fn();
		destroy = jest.fn();
	},
	Menu: { buildFromTemplate },
	nativeImage: { createFromPath: jest.fn(() => ({ resize: jest.fn(() => ({})) })) },
}));

jest.mock('../../../../src/main/i18n', () => ({
	loadTranslations: () => ({
		showChat: 'Show Chat',
		hideChat: 'Hide Chat',
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

function trayClickHandler(): () => void {
	const handler = [...trayOn.mock.calls].reverse().find(([event]) => event === 'click')?.[1];
	if (typeof handler !== 'function') throw new Error('Tray click handler was not registered.');
	return handler;
}

it('labels the main-window action as Show Chat or Hide Chat', () => {
	let appVisible = false;
	const tray = new Tray({
		onToggleChat: () => {
			appVisible = !appVisible;
		},
		onStartPersona: jest.fn(),
		onHidePersona: jest.fn(),
		onShowPersona: jest.fn(),
		onQuit: jest.fn(),
		isAppVisible: () => appVisible,
		isPersonaActive: () => false,
		isPersonaVisible: () => false,
		getTrayClickAction: () => 'toggle-chat',
		getApps: () => [],
		onOpenApp: jest.fn(),
	});

	tray.create();
	let template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	const showChat = template.find((entry) => entry.label === 'Show Chat');
	expect(showChat).toBeDefined();
	showChat?.click?.();

	tray.updateContextMenu();
	template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	expect(template.find((entry) => entry.label === 'Hide Chat')).toBeDefined();
});

it('lists microphone inputs and checks the persisted selection', async () => {
	let selected = 'usb';
	const tray = new Tray({
		onToggleChat: jest.fn(),
		onStartPersona: jest.fn(),
		onHidePersona: jest.fn(),
		onShowPersona: jest.fn(),
		onQuit: jest.fn(),
		isAppVisible: () => false,
		isPersonaActive: () => false,
		isPersonaVisible: () => false,
		getTrayClickAction: () => 'toggle-chat',
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
		onToggleChat: jest.fn(),
		onStartPersona: startPersona,
		onHidePersona: hidePersona,
		onShowPersona: showPersona,
		onQuit: jest.fn(),
		isAppVisible: () => false,
		isPersonaActive: () => active,
		isPersonaVisible: () => visible,
		getTrayClickAction: () => 'toggle-chat',
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

it('activates, hides, and shows Persona from the configured tray icon action', () => {
	let action: 'toggle-chat' | 'toggle-persona' = 'toggle-chat';
	let active = false;
	let visible = false;
	const toggleChat = jest.fn();
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
		onToggleChat: toggleChat,
		onStartPersona: startPersona,
		onHidePersona: hidePersona,
		onShowPersona: showPersona,
		onQuit: jest.fn(),
		isAppVisible: () => false,
		isPersonaActive: () => active,
		isPersonaVisible: () => visible,
		getTrayClickAction: () => action,
		getApps: () => [],
		onOpenApp: jest.fn(),
	});

	tray.create();
	const click = trayClickHandler();
	click();
	action = 'toggle-persona';
	click();
	click();
	click();

	expect(toggleChat).toHaveBeenCalledTimes(1);
	expect(startPersona).toHaveBeenCalledTimes(1);
	expect(hidePersona).toHaveBeenCalledTimes(1);
	expect(showPersona).toHaveBeenCalledTimes(1);
});
