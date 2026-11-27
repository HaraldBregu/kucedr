import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, dialog, type MessageBoxOptions } from 'electron';
import { userDataLocation } from '../shared/user_data_location';
import { same } from './same';

// Folders whose files can run on this computer: plugin code and scripts, connector (MCP) servers
// and their commands, and skills.
const CODE: Record<string, string> = { plugins: 'plugins', mcp: 'connector servers', skills: 'skills' };

// Restore must not bring code that runs before the user agrees. The code folders are copied aside
// first; any the restore changed are swapped back at once, and the restored copy is used only if
// the user chooses it.
// ponytail: copies the code folders on every restore; fine at their usual size.
export async function holdRestoredCode<T>(restore: () => Promise<T>): Promise<T> {
	const data = userDataLocation();
	const hold = path.join(data, 'storage', 'restore-hold');
	const before = (name: string): string => path.join(hold, 'before', name);
	const restored = (name: string): string => path.join(hold, 'restored', name);
	rmSync(hold, { recursive: true, force: true });
	mkdirSync(path.join(hold, 'restored'), { recursive: true });
	for (const name of Object.keys(CODE))
		if (existsSync(path.join(data, name)))
			cpSync(path.join(data, name), before(name), { recursive: true, verbatimSymlinks: true });
	try {
		return await restore();
	} finally {
		const changed = Object.keys(CODE).filter((name) => !same(path.join(data, name), before(name)));
		for (const name of changed) {
			const live = path.join(data, name);
			if (existsSync(live)) renameSync(live, restored(name));
			if (existsSync(before(name))) renameSync(before(name), live);
		}
		if (changed.length) {
			const options: MessageBoxOptions = {
				type: 'warning',
				buttons: ['Keep this computer’s', 'Use restored'],
				cancelId: 0,
				defaultId: 0,
				noLink: true,
				message: `The backup has different ${changed.map((name) => CODE[name]).join(', ')}.`,
				detail:
					'They can run code on this computer, so they stay off until you choose. Use the restored ones only if you made this backup yourself.',
			};
			const window = BrowserWindow.getFocusedWindow();
			const { response } = await (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options));
			if (response === 1)
				for (const name of changed) {
					rmSync(path.join(data, name), { recursive: true, force: true });
					if (existsSync(restored(name))) renameSync(restored(name), path.join(data, name));
				}
		}
		rmSync(hold, { recursive: true, force: true });
	}
}
