import { safeStorage } from 'electron';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { userDataLocation } from '../shared/user_data_location';
import { readLogins } from './csv';
import { writeFileAtomic } from './write';

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

// A password is only ever offered or filled on a secure page: https, or localhost over http
// for local development. Never on a plain http site.
function secure(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.protocol === 'https:') return true;
		const name = parsed.hostname.toLowerCase();
		return parsed.protocol === 'http:' && (name === 'localhost' || name.endsWith('.localhost') || name === '127.0.0.1' || name === '[::1]');
	} catch {
		return false;
	}
}

// ponytail: subdomains of a site match in both directions, which over-matches on shared hosts
// like github.io; tighten with the public suffix list when 23.13 lands.
function sameSite(a: string, b: string): boolean {
	return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

// A saved login may be filled on a page only when the page is secure and its host matches the
// login's. Checked again at fill time against the tab's real address, not the page's own report.
export function canFill(savedUrl: string, pageUrl: string): boolean {
	return secure(pageUrl) && sameSite(host(pageUrl), host(savedUrl)) && host(savedUrl) !== '';
}

// Distinguishes a missing store (safe to create) from one that exists but cannot be decrypted
// (must never be overwritten, or every saved password is lost).
function load(): { logins: Login[]; broken: boolean } {
	const sealed = file();
	if (!existsSync(sealed)) return { logins: [], broken: false };
	if (!isSafeStorageAvailable()) return { logins: [], broken: true };
	try {
		return { logins: JSON.parse(safeStorage.decryptString(readFileSync(sealed))) as Login[], broken: false };
	} catch {
		return { logins: [], broken: true };
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
	const { logins, broken } = load();
	if (broken)
		throw new Error('Your saved passwords could not be read, so nothing was imported — importing would have overwritten them.');
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
	return load()
		.logins.map(({ id, url, username }) => ({ id, url, username }))
		.sort((a, b) => a.url.localeCompare(b.url));
}

export function countLogins(): number {
	return load().logins.length;
}

export function clearLogins(): void {
	rmSync(file(), { force: true });
}

export function matchLogins(url: string): LoginListing[] {
	if (!secure(url)) return [];
	const site = host(url);
	if (!site) return [];
	return load()
		.logins.filter((login) => sameSite(site, host(login.url)))
		.map(({ id, url: at, username }) => ({ id, url: at, username }));
}

// Returned only to the fill code in main, never over IPC, never to the model.
export function secretFor(id: string): Login | undefined {
	return load().logins.find((login) => login.id === id);
}
