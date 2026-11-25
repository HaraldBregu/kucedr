import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';
import type { VaultState } from '../../shared/vault';
import { writeFileAtomic } from '../browser/write';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { userDataLocation } from '../shared/user_data_location';
import { convertVault } from './convert';
import { vaultKey } from './key';

const file = path.join(userDataLocation(), 'settings', 'vault.json');

let enabled = false;
let key: string | undefined;
let broken = false;
try {
	const saved = JSON.parse(readFileSync(file, 'utf8')) as { enabled?: unknown; key?: unknown };
	enabled = saved.enabled !== false;
	key = typeof saved.key === 'string' ? saved.key : undefined;
} catch (error) {
	broken = (error as NodeJS.ErrnoException).code !== 'ENOENT';
	enabled = broken;
}

export const isVaultEnabled = (): boolean => enabled;
export const sealedVaultKey = (): string | undefined => key;

export function getVault(): VaultState {
	return { enabled, available: isSafeStorageAvailable() };
}

export function setVault(next: boolean): VaultState {
	if (typeof next !== 'boolean') throw new Error('Invalid encryption setting.');
	if (broken) throw new Error('Encryption settings could not be read, so nothing was changed.');
	if (next && !key) {
		if (!isSafeStorageAvailable()) throw new Error('Secure storage is unavailable.');
		key = safeStorage.encryptString(randomBytes(32).toString('base64')).toString('base64');
	}
	if (next) vaultKey();
	writeFileAtomic(file, JSON.stringify({ enabled: next, key }));
	enabled = next;
	convertVault();
	return getVault();
}
