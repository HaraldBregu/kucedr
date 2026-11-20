import { safeStorage } from 'electron';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { restrictSettingsFile } from '../shared/restrict_settings_file';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { userDataLocation } from '../shared/user_data_location';
import { readLogins } from './csv';

export interface Login {
	readonly id: string;
	readonly url: string;
	readonly username: string;
	readonly password: string;
}

export type LoginListing = Omit<Login, 'password'>;

function file(): string {
	return path.join(userDataLocation(), 'browser', 'passwords.seal');
}

function host(url: string): string {
	try {
		return new URL(url).host.toLowerCase();
	} catch {
		return '';
	}
}

function open(): Login[] {
	const sealed = file();
	if (!existsSync(sealed) || !isSafeStorageAvailable()) return [];
	try {
		return JSON.parse(safeStorage.decryptString(readFileSync(sealed))) as Login[];
	} catch {
		return [];
	}
}

function seal(logins: Login[]): void {
	const sealed = file();
	restrictSettingsFile(sealed);
	writeFileSync(sealed, safeStorage.encryptString(JSON.stringify(logins)), { mode: 0o600 });
}

export function passwordsAvailable(): boolean {
	return isSafeStorageAvailable();
}

export function importLogins(text: string): number {
	if (!isSafeStorageAvailable()) throw new Error('The system keystore is unavailable, so passwords cannot be stored safely.');
	const logins = open();
	const seen = new Set(logins.map((login) => `${host(login.url)}\n${login.username}`));
	let added = 0;
	for (const entry of readLogins(text)) {
		const key = `${host(entry.url)}\n${entry.username}`;
		if (seen.has(key)) continue;
		seen.add(key);
		logins.push({ id: `p${logins.length + added + 1}-${Date.now().toString(36)}`, ...entry });
		added += 1;
	}
	if (added) seal(logins);
	return added;
}

export function listLogins(): LoginListing[] {
	return open()
		.map(({ id, url, username }) => ({ id, url, username }))
		.sort((a, b) => a.url.localeCompare(b.url));
}

export function countLogins(): number {
	return open().length;
}

export function clearLogins(): void {
	rmSync(file(), { force: true });
}

export function matchLogins(url: string): LoginListing[] {
	const site = host(url);
	if (!site) return [];
	return open()
		.filter((login) => host(login.url) === site)
		.map(({ id, url: at, username }) => ({ id, url: at, username }));
}

// Returned only to the fill code in main, never over IPC, never to the model.
export function secretFor(id: string): Login | undefined {
	return open().find((login) => login.id === id);
}
