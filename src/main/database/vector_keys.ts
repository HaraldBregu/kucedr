import path from 'node:path';
import { safeStorage } from 'electron';
import Store from 'electron-store';
import { userDataLocation } from '../shared/user_data_location';
import { isSafeStorageAvailable } from '../shared/safe_storage';

const store = new Store<{ keys: Record<string, string> }>({
	name: 'vector',
	cwd: path.resolve(userDataLocation(), 'providers'),
	accessPropertiesByDotNotation: false,
	defaults: { keys: {} },
});

/** The decrypted API key saved on a VECTOR script's page. */
export function vectorScriptKey(name: string): string | undefined {
	const encrypted = store.get('keys')[name];
	if (!encrypted) return undefined;
	if (!isSafeStorageAvailable()) throw new Error('Secure storage is unavailable.');
	return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
}

export function saveVectorScriptKey(name: string, apiKey: string): void {
	if (!isSafeStorageAvailable()) throw new Error('Secure storage is unavailable.');
	store.set('keys', {
		...store.get('keys'),
		[name]: safeStorage.encryptString(apiKey).toString('base64'),
	});
}
