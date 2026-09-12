import { chmodSync } from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';
import Store from 'electron-store';
import { userDataLocation } from '../shared/user_data_location';
import { isSafeStorageAvailable } from '../shared/safe_storage';

interface AuthSessionState {
	values: Record<string, string>;
}

export interface AuthStorage {
	readonly persistence: 'encrypted' | 'memory';
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export class AuthSessionStorage implements AuthStorage {
	private readonly memory = new Map<string, string>();
	private memoryOnly = false;

	constructor(
		private readonly store: Store<AuthSessionState> = new Store<AuthSessionState>({
			name: 'account',
			cwd: path.resolve(userDataLocation(), 'settings'),
			accessPropertiesByDotNotation: false,
			defaults: { values: {} },
		})
	) {}

	get persistence(): 'encrypted' | 'memory' {
		return !this.memoryOnly && this.secureStorageAvailable() ? 'encrypted' : 'memory';
	}

	getItem(key: string): string | null {
		const memoryValue = this.memory.get(key);
		if (memoryValue !== undefined) return memoryValue;
		if (!this.secureStorageAvailable()) {
			this.memoryOnly = true;
			return null;
		}
		const encrypted = this.store.get('values')[key];
		if (!encrypted) return null;
		try {
			return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
		} catch {
			this.removeItem(key);
			return null;
		}
	}

	setItem(key: string, value: string): void {
		if (this.memoryOnly || !this.secureStorageAvailable()) {
			this.memoryOnly = true;
			this.memory.set(key, value);
			return;
		}
		try {
			this.store.set('values', {
				...this.store.get('values'),
				[key]: safeStorage.encryptString(value).toString('base64'),
			});
			this.memory.delete(key);
			this.restrictPermissions();
		} catch {
			this.memoryOnly = true;
			this.memory.set(key, value);
		}
	}

	removeItem(key: string): void {
		this.memory.delete(key);
		const values = { ...this.store.get('values') };
		if (!(key in values)) return;
		delete values[key];
		this.store.set('values', values);
		this.restrictPermissions();
	}

	private secureStorageAvailable(): boolean {
		return isSafeStorageAvailable();
	}

	private restrictPermissions(): void {
		try {
			chmodSync(path.dirname(this.store.path), 0o700);
			chmodSync(this.store.path, 0o600);
		} catch {
			return;
		}
	}
}
