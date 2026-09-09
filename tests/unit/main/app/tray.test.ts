const buildFromTemplate = jest.fn((template: unknown) => template);

jest.mock('electron', () => ({
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
		onQuit: jest.fn(),
		isAppVisible: () => false,
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
