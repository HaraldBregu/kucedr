import path from 'node:path';
import { safeStorage } from 'electron';
import Store from 'electron-store';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { userDataLocation } from '../shared/user_data_location';

/** Remembers each account's derived file key on this device, encrypted with safeStorage. Never the passphrase. */
export class CredentialKeychain {
	constructor(
		private readonly store: Store<{ keys: Record<string, string> }> = new Store({
			name: 'keys',
			cwd: path.resolve(userDataLocation(), 'credentials'),
			accessPropertiesByDotNotation: false,
			defaults: { keys: {} },
		})
	) {}

	get(userId: string): Buffer | undefined {
		const value = this.store.get('keys')[userId];
		if (!value || !isSafeStorageAvailable()) return undefined;
		try {
			return Buffer.from(safeStorage.decryptString(Buffer.from(value, 'base64')), 'base64');
		} catch {
			return undefined;
		}
	}

	set(userId: string, key: Buffer): void {
		if (!isSafeStorageAvailable()) return;
		const value = safeStorage.encryptString(key.toString('base64')).toString('base64');
		this.store.set('keys', { ...this.store.get('keys'), [userId]: value });
	}

	delete(userId: string): void {
		const { [userId]: _removed, ...keys } = this.store.get('keys');
		this.store.set('keys', keys);
	}
}
