import { webContents } from 'electron';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { boundWorkspaces } from './bound';

export function sendToWorkspace(id: string, channel: string, ...args: unknown[]): void {
	for (const contents of webContents.getAllWebContents()) {
		if (contents.isDestroyed()) continue;
		if ((boundWorkspaces.get(contents.id) ?? DEFAULT_WORKSPACE) === id) contents.send(channel, ...args);
	}
}
