import type { BrowserWindow } from 'electron';
import { AppChannels } from '../shared/ipc_channels_definitions';
import { SHORTCUTS, type ShortcutId } from '../shared/app_types';

interface KeyCombo {
	key: string;
	ctrl: boolean;
	meta: boolean;
	shift: boolean;
	alt: boolean;
}

interface ShortcutBinding {
	id: ShortcutId;
	combo: KeyCombo;
}

function parseAccelerator(accelerator: string, isMac: boolean): KeyCombo {
	const parts = accelerator.split('+').map((p) => p.trim().toLowerCase());
	const key = parts[parts.length - 1];
	const mods = parts.slice(0, -1);

	const hasCmdOrCtrl = mods.includes('cmdorctrl') || mods.includes('commandorcontrol');

	return {
		key,
		ctrl: mods.includes('ctrl') || mods.includes('control') || (!isMac && hasCmdOrCtrl),
		meta:
			mods.includes('cmd') ||
			mods.includes('command') ||
			mods.includes('meta') ||
			(isMac && hasCmdOrCtrl),
		shift: mods.includes('shift'),
		alt: mods.includes('alt') || mods.includes('option'),
	};
}

/**
 * Registers app-level keyboard shortcuts on each BrowserWindow via
 * `before-input-event`. When a registered combo is pressed inside a focused
 * window, the matching ShortcutId is forwarded to the renderer on
 * `app:shortcut`.
 *
 * Works across application windows without depending on the application menu.
 */
export class ShortcutManager {
	private readonly bindings: ShortcutBinding[];

	constructor() {
		const isMac = process.platform === 'darwin';
		this.bindings = SHORTCUTS.filter(
			(shortcut): shortcut is (typeof SHORTCUTS)[number] & { target: 'renderer'; accelerator: string } =>
				'target' in shortcut && shortcut.target === 'renderer' && 'accelerator' in shortcut
		).map(({ id, accelerator }) => ({ id, combo: parseAccelerator(accelerator, isMac) }));
	}

	attach(win: BrowserWindow): void {
		win.webContents.on('before-input-event', (event, input) => {
			if (input.type !== 'keyDown' || input.isAutoRepeat) return;
			const match = this.findMatch(input);
			if (!match) return;
			event.preventDefault();
			win.webContents.send(AppChannels.shortcut, match.id);
		});
	}

	private findMatch(input: Electron.Input): ShortcutBinding | undefined {
		const key = input.key.toLowerCase();
		return this.bindings.find(
			({ combo }) =>
				key === combo.key &&
				input.control === combo.ctrl &&
				input.meta === combo.meta &&
				input.shift === combo.shift &&
				input.alt === combo.alt
		);
	}
}
