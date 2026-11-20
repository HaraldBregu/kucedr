import type { BrowserTab } from './pane';

const MODIFIERS: Record<string, number> = { Alt: 1, Control: 2, Ctrl: 2, Meta: 4, Shift: 8 };
const KEYS: Record<string, { code: number; text?: string; command?: string }> = {
	Enter: { code: 13, text: '\r', command: 'insertNewline' },
	Tab: { code: 9, command: 'insertTab' },
	Backspace: { code: 8, command: 'deleteBackward' },
	Delete: { code: 46, command: 'deleteForward' },
	Escape: { code: 27 },
	Space: { code: 32, text: ' ' },
	ArrowLeft: { code: 37, command: 'moveLeft' },
	ArrowUp: { code: 38, command: 'moveUp' },
	ArrowRight: { code: 39, command: 'moveRight' },
	ArrowDown: { code: 40, command: 'moveDown' },
	PageUp: { code: 33 },
	PageDown: { code: 34 },
	End: { code: 35 },
	Home: { code: 36 },
};

export async function press(tab: BrowserTab, combination: string): Promise<void> {
	const parts = combination === '+' ? ['+'] : combination.split('+');
	const name = parts.pop() ?? '';
	const modifiers = parts.reduce((bits, part) => {
		if (!(part in MODIFIERS)) throw new Error(`Unknown modifier "${part}".`);
		return bits | MODIFIERS[part];
	}, 0);
	const fn = /^F([1-9]|1[0-2])$/.exec(name);
	const known = KEYS[name] ?? (fn ? { code: 111 + Number(fn[1]) } : undefined);
	if (!known && [...name].length !== 1) throw new Error(`Unknown key "${name}".`);
	const shortcut = (modifiers & 6) !== 0;
	const event = known
		? {
				key: name === 'Space' ? ' ' : name,
				code: name,
				windowsVirtualKeyCode: known.code,
				...(known.text && !shortcut ? { text: known.text } : {}),
				...(known.command && process.platform === 'darwin' && !modifiers
					? { commands: [known.command] }
					: {}),
			}
		: {
				key: name,
				code: /^[a-z]$/i.test(name) ? `Key${name.toUpperCase()}` : /^\d$/.test(name) ? `Digit${name}` : '',
				windowsVirtualKeyCode: name.toUpperCase().charCodeAt(0),
				...(shortcut ? {} : { text: name }),
				...(process.platform === 'darwin' && modifiers === 4 && name.toLowerCase() === 'a'
					? { commands: ['selectAll'] }
					: {}),
			};
	const send = tab.view.webContents.debugger;
	await send.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, ...event });
	await send.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, ...event });
}
