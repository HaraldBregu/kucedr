import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, dialog } from 'electron';
import { userDataLocation } from '../shared/user_data_location';

// Folders whose files can run on this computer: plugin code and scripts, connector (MCP) servers
// and their commands, and skills.
const CODE = [
	['plugins', 'plugins'],
	['mcp', 'connector servers'],
	['skills', 'skills'],
] as const;

function same(a: string, b: string): boolean {
	const ea = existsSync(a);
	if (ea !== existsSync(b)) return false;
	if (!ea) return true;
	if (statSync(a).isDirectory() !== statSync(b).isDirectory()) return false;
	if (!statSync(a).isDirectory()) return readFileSync(a).equals(readFileSync(b));
	const names = readdirSync(a).sort();
	const other = readdirSync(b).sort();
	return names.length === other.length && names.every((name, index) => name === other[index] && same(path.join(a, name), path.join(b, name)));
}

// Restore must not bring code that runs before the user agrees. The code folders are copied
// aside first; any that the restore changed are swapped back and kept in a holding folder until
// the user chooses to use them.
// ponytail: copies the code folders on every restore; fine at their usual size.
export async function holdRestoredCode<T>(restore: () => Promise<T>): Promise<T> {
	const data = userDataLocation();
	const hold = path.join(data, 'storage', 'restore-hold');
	rmSync(hold, { recursive: true, force: true });
	for (const [name] of CODE) {
		const live = path.join(data, name);
		if (existsSync(live)) cpSync(live, path.join(hold, 'before', name), { recursive: true, verbatimSymlinks: true });
	}
	let result: T;
	try {
		result = await restore();
	} finally {
		const changed: string[] = [];
		for (const [name, label] of CODE) {
			const live = path.join(data, name);
			const before = path.join(hold, 'before', name);
			if (same(live, before)) continue;
			changed.push(label);
			if (existsSync(live)) renameSync(live, path.join(hold, 'restored', name).replace(/$/, ''));
			if (existsSync(before)) renameSync(before, live);
		}
		if (changed.length) await offer(data, hold, changed);
		rmSync(hold, { recursive: true, force: true });
	}
	return result;
}

async function offer(data: string, hold: string, changed: string[]): Promise<void> {
	const options = {
		type: 'warning' as const,
		buttons: ['Keep this computer’s', 'Use restored'],
		cancelId: 0,
		defaultId: 0,
		noLink: true,
		message: `The backup has different ${changed.join(', ')}.`,
		detail:
			'They can run code on this computer. They are kept off until you choose. Use the restored ones only if you made this backup yourself.',
	};
	const window = BrowserWindow.getFocusedWindow();
	const { response } = await (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options));
	if (response !== 1) return;
	for (const [name] of CODE) {
		const restored = path.join(hold, 'restored', name);
		if (!existsSync(restored) && !changed.length) continue;
		const live = path.join(data, name);
		const wasChanged = existsSync(restored) || !same(live, path.join(hold, 'before', name));
		if (!wasChanged) continue;
		rmSync(live, { recursive: true, force: true });
		if (existsSync(restored)) renameSync(restored, live);
	}
}
