import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { systemPreferences } from 'electron';
import { LOCK_IDLE_MINUTES, type LockState, type LockUpdate } from '../../shared/lock';
import { writeFileAtomic } from '../browser/write';
import { userDataLocation } from '../shared/user_data_location';

interface Config {
	readonly enabled: boolean;
	readonly salt: string;
	readonly hash: string;
	readonly touchId: boolean;
	readonly idleMinutes: number;
}

const file = path.join(userDataLocation(), 'settings', 'lock.json');
const events = new EventEmitter();

let config: Config = { enabled: false, salt: '', hash: '', touchId: false, idleMinutes: 15 };
try {
	const saved = JSON.parse(readFileSync(file, 'utf8')) as Partial<Config> | null;
	if (typeof saved?.salt === 'string' && typeof saved.hash === 'string') {
		config = { ...config, ...saved };
	}
} catch {
	// A missing or corrupt file leaves the lock off: locking without a usable hash is a lockout.
}
let locked = config.enabled === true;
let failures = 0;
let blockedUntil = 0;

const derive = (passphrase: string, salt: string): Buffer =>
	scryptSync(passphrase, Buffer.from(salt, 'base64'), 32);

function emit(): LockState {
	const state = getLock();
	events.emit('change', state);
	return state;
}

export const lockChanged = events;
export const isLocked = (): boolean => locked;

export function getLock(): LockState {
	return {
		enabled: config.enabled,
		locked,
		touchId: config.touchId,
		touchIdAvailable: process.platform === 'darwin' && systemPreferences.canPromptTouchID(),
		idleMinutes: config.idleMinutes,
	};
}

export function setLock(update: LockUpdate): LockState {
	if (locked) throw new Error('Unlock the app first.');
	if (typeof update?.enabled !== 'boolean') throw new Error('Invalid app lock setting.');
	const {
		enabled,
		passphrase,
		touchId = config.touchId,
		idleMinutes = config.idleMinutes,
	} = update;
	if (typeof touchId !== 'boolean' || !LOCK_IDLE_MINUTES.includes(idleMinutes)) {
		throw new Error('Invalid app lock setting.');
	}
	let { salt, hash } = config;
	if (passphrase !== undefined) {
		if (typeof passphrase !== 'string' || passphrase.length < 4) {
			throw new Error('The passphrase needs at least 4 characters.');
		}
		salt = randomBytes(16).toString('base64');
		hash = derive(passphrase, salt).toString('base64');
	}
	if (enabled && !hash) throw new Error('Choose a passphrase to turn on the app lock.');
	const next: Config = { enabled, salt, hash, touchId, idleMinutes };
	mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	writeFileAtomic(file, JSON.stringify(next));
	config = next;
	return emit();
}

export function unlock(passphrase: string): LockState {
	if (!locked) return getLock();
	const wait = Math.ceil((blockedUntil - Date.now()) / 1000);
	if (wait > 0) throw new Error(`Too many attempts. Try again in ${wait} seconds.`);
	const expected = Buffer.from(config.hash, 'base64');
	const actual = derive(String(passphrase), config.salt);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
		failures += 1;
		if (failures < 5) throw new Error('Wrong passphrase.');
		failures = 0;
		blockedUntil = Date.now() + 30_000;
		throw new Error('Too many attempts. Try again in 30 seconds.');
	}
	return unlocked();
}

export function unlocked(): LockState {
	if (!locked) return getLock();
	failures = 0;
	locked = false;
	return emit();
}

export function lock(): LockState {
	if (!config.enabled || locked) return getLock();
	locked = true;
	return emit();
}
