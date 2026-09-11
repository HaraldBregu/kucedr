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
	nativeImage: {
		createFromPath: jest.fn(() => ({
			resize: jest.fn(() => ({ setTemplateImage: jest.fn() })),
		})),
	},
}));

jest.mock('../../../../src/main/i18n', () => ({
	loadTranslations: () => ({
		showChat: 'Show Chat Agent',
		hideChat: 'Hide Chat Agent',
		startPersona: 'Start Voice Agent',
		hidePersona: 'Hide Voice Agent',
		showPersona: 'Show Voice Agent',
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

it('labels the main-window action as Show Chat Agent or Hide Chat Agent', () => {
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
		getTasks: () => [],
		onStartTask: jest.fn(),
	});

	tray.create();
	let template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	const showChat = template.find((entry) => entry.label === 'Show Chat Agent');
	expect(showChat).toBeDefined();
	showChat?.click?.();

	tray.updateContextMenu();
	template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	expect(template.find((entry) => entry.label === 'Hide Chat Agent')).toBeDefined();
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
		getTasks: () => [],
		onStartTask: jest.fn(),
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

it('starts, hides, and shows the Voice Agent without ending its conversation', () => {
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
		getTasks: () => [],
		onStartTask: jest.fn(),
	});

	tray.create();
	let template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	let personaItem = template.find((entry) => entry.label === 'Start Voice Agent');
	expect(personaItem).toMatchObject({ enabled: true });
	personaItem?.click?.();

	tray.updateContextMenu();
	template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	personaItem = template.find((entry) => entry.label === 'Hide Voice Agent');
	expect(personaItem).toMatchObject({ enabled: true });
	personaItem?.click?.();

	tray.updateContextMenu();
	template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	personaItem = template.find((entry) => entry.label === 'Show Voice Agent');
	expect(personaItem).toMatchObject({ enabled: true });
	personaItem?.click?.();
	expect(startPersona).toHaveBeenCalledTimes(1);
	expect(hidePersona).toHaveBeenCalledTimes(1);
	expect(showPersona).toHaveBeenCalledTimes(1);
	expect(active).toBe(true);
});

it('activates, hides, and shows Voice Agent from the configured tray icon action', () => {
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
		getTasks: () => [],
		onStartTask: jest.fn(),
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

it('lists tasks in the Tasks submenu and starts the selected task', () => {
	const onStartTask = jest.fn();
	const task = {
		id: 'task-1',
		name: 'Summarize inbox',
		enabled: false,
		prompt: 'Summarize my inbox.',
		sessionIds: [],
		createdAt: '2026-09-11T00:00:00.000Z',
		updatedAt: '2026-09-11T00:00:00.000Z',
	};
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
		getTasks: () => [task],
		onStartTask,
	});

	tray.create();

	const template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	const tasks = template.find((entry) => entry.label === 'Tasks');
	expect(tasks?.submenu?.map((entry) => entry.label)).toEqual(['Summarize inbox']);
	tasks?.submenu?.[0]?.click?.();
	expect(onStartTask).toHaveBeenCalledWith(task);
});

it('truncates long task titles in the Tasks submenu', () => {
	const task = {
		id: 'task-1',
		name: 'A'.repeat(49),
		enabled: true,
		prompt: 'Run the task.',
		sessionIds: [],
		createdAt: '2026-09-11T00:00:00.000Z',
		updatedAt: '2026-09-11T00:00:00.000Z',
	};
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
		getTasks: () => [task],
		onStartTask: jest.fn(),
	});

	tray.create();

	const template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	const taskItem = template.find((entry) => entry.label === 'Tasks')?.submenu?.[0];
	expect(taskItem).toMatchObject({ label: `${'A'.repeat(47)}…`, toolTip: task.name });
});
