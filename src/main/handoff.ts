import { shell } from 'electron';
import { requireUnrestrictedNetwork } from './privacy/state';

export async function openExternal(url: string): Promise<void> {
	requireUnrestrictedNetwork();
	await shell.openExternal(url);
}
