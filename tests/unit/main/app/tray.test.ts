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
		showVoiceConversation: 'Show Voice Conversation',
		hideVoiceConversation: 'Hide Voice Conversation',
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
		onToggleVoiceConversation: jest.fn(),
		onQuit: jest.fn(),
		isAppVisible: () => false,
		isVoiceConversationVisible: () => false,
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

it('shows and hides the active voice conversation from the tray', () => {
	let visible = false;
	const toggleVoiceConversation = jest.fn(() => {
		visible = !visible;
	});
	const tray = new Tray({
		onToggleApp: jest.fn(),
		onToggleVoiceConversation: toggleVoiceConversation,
		onQuit: jest.fn(),
		isAppVisible: () => false,
		isVoiceConversationVisible: () => visible,
		getApps: () => [],
		onOpenApp: jest.fn(),
	});

	tray.create();
	let template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	let voiceItem = template.find((entry) => entry.label === 'Show Voice Conversation');
	expect(voiceItem).toMatchObject({ enabled: true });
	voiceItem?.click?.();

	tray.updateContextMenu();
	template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
	voiceItem = template.find((entry) => entry.label === 'Hide Voice Conversation');
	expect(voiceItem).toMatchObject({ enabled: true });
	voiceItem?.click?.();
	expect(toggleVoiceConversation).toHaveBeenCalledTimes(2);
});
