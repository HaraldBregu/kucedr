import { safeStorage } from 'electron';
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { getDomain } from 'tldts';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { userDataLocation } from '../shared/user_data_location';
import { readLogins } from './csv';
import { writeFileAtomic } from './write';

export interface LoginListing {
	readonly id: string;
	readonly url: string;
	readonly username: string;
	// Set when the login was saved for a related host of the same site, e.g. accounts.example.com.
	readonly savedFor?: string;
}

// The store keeps sites and usernames readable, so listing and matching never decrypt a
// password. Each password is encrypted on its own (AES-256-GCM) with a random store key, and
// only that key is sealed by the system keystore.
interface Entry extends Omit<LoginListing, 'savedFor'> {
	readonly created: number;
	readonly secret: string;
}

interface Store {
	readonly version: 2;
	readonly key: string;
	readonly logins: Entry[];
	// Hosts where the user chose "Never for this site".
	readonly never?: string[];
}

let cached: { store: Store | undefined; broken: boolean } | undefined;
let storeKey: Buffer | undefined;

function file(): string {
	return path.join(userDataLocation(), 'browser', 'passwords.json');
}

function parse(url: string): URL | undefined {
	try {
		return new URL(url);
	} catch {
		return undefined;
	}
}

function host(url: string): string {
	return parse(url)?.host.toLowerCase() ?? '';
}

// A password is only ever offered or filled on a secure page: https, or localhost over http
// for local development. Never on a plain http site.
function secure(url: string): boolean {
	const parsed = parse(url);
	if (!parsed) return false;
	if (parsed.protocol === 'https:') return true;
	const name = parsed.hostname.toLowerCase();
	return parsed.protocol === 'http:' && (name === 'localhost' || name.endsWith('.localhost') || name === '127.0.0.1' || name === '[::1]');
}

// 'exact' for the same host, 'related' for another host of the same registrable domain under
// the public suffix list (so a.github.io never matches b.github.io), undefined otherwise.
function relation(pageUrl: string, savedUrl: string): 'exact' | 'related' | undefined {
	const page = parse(pageUrl);
	const saved = parse(savedUrl);
	if (!page || !saved || !saved.host) return undefined;
	if (page.host.toLowerCase() === saved.host.toLowerCase()) return 'exact';
	const site = getDomain(page.hostname, { allowPrivateDomains: true });
	return site && site === getDomain(saved.hostname, { allowPrivateDomains: true }) ? 'related' : undefined;
}

// A saved login may be filled on a page only when the page is secure and its site matches the
// login's. Checked again at fill time against the tab's real address, not the page's own report.
export function canFill(savedUrl: string, pageUrl: string): boolean {
	return secure(pageUrl) && relation(pageUrl, savedUrl) !== undefined;
}

// Distinguishes a missing store (safe to create) from one that exists but cannot be read
// (must never be overwritten, or every saved password is lost).
function load(): { store: Store | undefined; broken: boolean } {
	if (cached) return cached;
	const sealed = file();
	if (!existsSync(sealed)) return (cached = { store: undefined, broken: false });
	try {
		const store = JSON.parse(readFileSync(sealed, 'utf8')) as Store;
		cached = { store, broken: store.version !== 2 || !Array.isArray(store.logins) };
	} catch {
		cached = { store: undefined, broken: true };
	}
	return cached;
}

function unseal(store: Store): Buffer {
	if (storeKey) return storeKey;
	if (!isSafeStorageAvailable()) throw new Error('The system keystore is unavailable, so saved passwords cannot be opened.');
	try {
		storeKey = Buffer.from(safeStorage.decryptString(Buffer.from(store.key, 'base64')), 'base64');
	} catch {
		throw new Error('Your saved passwords could not be opened with the system keystore.');
	}
	return storeKey;
}

// The site and username are bound to the ciphertext, so a password moved to another entry or
// site in the file fails to decrypt instead of being filled there.
function bound(id: string, url: string, username: string): Buffer {
	return Buffer.from(`${id}\n${url}\n${username}`);
}

function encrypt(key: Buffer, id: string, url: string, username: string, password: string | Buffer): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv).setAAD(bound(id, url, username));
	const data = Buffer.concat([cipher.update(typeof password === 'string' ? Buffer.from(password) : password), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

function decrypt(key: Buffer, entry: Entry): Buffer {
	const raw = Buffer.from(entry.secret, 'base64');
	const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
		.setAAD(bound(entry.id, entry.url, entry.username))
		.setAuthTag(raw.subarray(12, 28));
	return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
}

// Keeps the previous copy beside the new one, written atomically.
function save(store: Store): void {
	const target = file();
	if (existsSync(target)) copyFileSync(target, `${target}.bak`);
	writeFileAtomic(target, JSON.stringify(store));
	cached = { store, broken: false };
}

export function passwordsAvailable(): boolean {
	return isSafeStorageAvailable();
}

// The current store, or a new empty one with a fresh key. Refuses a store that cannot be read.
function writable(): Store {
	if (!isSafeStorageAvailable()) throw new Error('The system keystore is unavailable, so passwords cannot be stored safely.');
	const { store, broken } = load();
	if (broken)
		throw new Error('Your saved passwords could not be read, so nothing was saved — saving would have overwritten them.');
	if (store) return store;
	storeKey = randomBytes(32);
	return { version: 2, key: safeStorage.encryptString(storeKey.toString('base64')).toString('base64'), logins: [] };
}

export function importLogins(text: string): number {
	const next = writable();
	const key = unseal(next);
	const logins = [...next.logins];
	const seen = new Set(logins.map((login) => `${host(login.url)}\n${login.username}`));
	for (const entry of readLogins(text)) {
		const dedupe = `${host(entry.url)}\n${entry.username}`;
		if (seen.has(dedupe)) continue;
		seen.add(dedupe);
		const id = randomUUID();
		logins.push({ id, url: entry.url, username: entry.username, created: Date.now(), secret: encrypt(key, id, entry.url, entry.username, entry.password) });
	}
	const added = logins.length - next.logins.length;
	if (added) save({ ...next, logins });
	return added;
}

export function listLogins(): LoginListing[] {
	return (load().store?.logins ?? [])
		.map(({ id, url, username }) => ({ id, url, username }))
		.sort((a, b) => a.url.localeCompare(b.url));
}

export function countLogins(): number {
	return load().store?.logins.length ?? 0;
}

export function clearLogins(): void {
	rmSync(file(), { force: true });
	rmSync(`${file()}.bak`, { force: true });
	cached = undefined;
	storeKey = undefined;
}

// Every change re-encrypts the password, since each ciphertext is bound to its site and username.
// An empty password keeps the one saved.
export function updateLogin(id: string, change: { url: string; username: string; password: string }): void {
	const { store, broken } = load();
	if (broken || !store) throw new Error('Your saved passwords could not be read.');
	const parsed = parse(change.url);
	if (!parsed || !/^https?:$/.test(parsed.protocol)) throw new Error('Enter a web address that starts with https://.');
	const entry = store.logins.find((login) => login.id === id);
	if (!entry) throw new Error('That saved password is no longer available.');
	const key = unseal(store);
	const kept = change.password ? undefined : decrypt(key, entry);
	const password = change.password || kept!.toString('utf8');
	kept?.fill(0);
	const url = parsed.href;
	const next = { ...entry, url, username: change.username, secret: encrypt(key, id, url, change.username, password) };
	save({ ...store, logins: store.logins.map((login) => (login.id === id ? next : login)) });
}

// After a manual sign-in: 'save' for a new login, 'update' when the saved password for this
// username on this host differs, undefined when there is nothing to offer.
export function offerFor(url: string, username: string, password: Buffer): 'save' | 'update' | undefined {
	if (!secure(url) || !password.length) return undefined;
	const { store, broken } = load();
	if (broken || store?.never?.includes(host(url))) return undefined;
	const same = store?.logins.find((login) => host(login.url) === host(url) && login.username === username);
	if (!store || !same) return 'save';
	const saved = decrypt(unseal(store), same);
	const changed = !saved.equals(password);
	saved.fill(0);
	return changed ? 'update' : undefined;
}

// Saves a login typed by hand, replacing the password of the same username on the same host.
export function saveLogin(url: string, username: string, password: Buffer): void {
	const store = writable();
	const key = unseal(store);
	const same = store.logins.find((login) => host(login.url) === host(url) && login.username === username);
	const id = same?.id ?? randomUUID();
	const savedUrl = same?.url ?? `${new URL(url).origin}/`;
	const entry: Entry = {
		id,
		url: savedUrl,
		username,
		created: same?.created ?? Date.now(),
		secret: encrypt(key, id, savedUrl, username, password.toString('utf8')),
	};
	save({ ...store, logins: same ? store.logins.map((login) => (login.id === id ? entry : login)) : [...store.logins, entry] });
}

export function neverSites(): string[] {
	return [...(load().store?.never ?? [])].sort();
}

export function setNever(url: string, never: boolean): void {
	const store = writable();
	const site = url.includes('://') ? host(url) : url.toLowerCase();
	const rest = (store.never ?? []).filter((item) => item !== site);
	save({ ...store, never: never ? [...rest, site] : rest });
}

export function deleteLogin(id: string): void {
	const { store, broken } = load();
	if (broken || !store) throw new Error('Your saved passwords could not be read.');
	save({ ...store, logins: store.logins.filter((login) => login.id !== id) });
}

export function matchLogins(url: string): LoginListing[] {
	if (!secure(url)) return [];
	return (load().store?.logins ?? []).flatMap(({ id, url: at, username }) => {
		const match = relation(url, at);
		if (!match) return [];
		return [{ id, url: at, username, ...(match === 'related' ? { savedFor: host(at) } : {}) }];
	});
}

// Returned only to the fill code in main, never over IPC, never to the model. The password is a
// buffer the caller wipes once it has been inserted.
export function secretFor(id: string): { url: string; username: string; password: Buffer } | undefined {
	const { store } = load();
	const entry = store?.logins.find((login) => login.id === id);
	if (!store || !entry) return undefined;
	return { url: entry.url, username: entry.username, password: decrypt(unseal(store), entry) };
}
