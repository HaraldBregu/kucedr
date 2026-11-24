import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PrivacyState } from '../../shared/privacy';
import { connections } from '../browser/connections';
import { writeFileAtomic } from '../browser/write';
import { userDataLocation } from '../shared/user_data_location';

const file = path.join(userDataLocation(), 'settings', 'privacy.json');
const supported = process.platform === 'darwin' && existsSync('/usr/bin/sandbox-exec');
const events = new EventEmitter();

let enabled = false;
try {
	enabled = JSON.parse(readFileSync(file, 'utf8')) !== false;
} catch (error) {
	enabled = (error as NodeJS.ErrnoException).code !== 'ENOENT';
}
const active = enabled;
const route = active ? connections().proxy : '';
const proxyPort = /^socks5:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(route)?.[1];
const proxy = proxyPort && Number(proxyPort) <= 65535 ? route : undefined;
let status: PrivacyState['status'] = active ? 'connecting' : 'off';

export const privacyChanged = events;
export const isPrivacyEnabled = (): boolean => active;
export const getPrivacyRoute = (): string | undefined => proxy;

export function getPrivacy(): PrivacyState {
	return {
		enabled,
		status,
		restartRequired: enabled !== active || (active && connections().proxy !== route),
		supported,
	};
}

export function setPrivacy(enabledAfterRestart: boolean): PrivacyState {
	if (typeof enabledAfterRestart !== 'boolean') throw new Error('Invalid privacy setting.');
	if (enabledAfterRestart && !supported) throw new Error('Privacy Mode requires macOS.');
	mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	writeFileAtomic(file, JSON.stringify(enabledAfterRestart));
	enabled = enabledAfterRestart;
	const state = getPrivacy();
	events.emit('change', state);
	return state;
}

export function setPrivacyStatus(next: PrivacyState['status']): void {
	if (status === next) return;
	status = next;
	events.emit('change', getPrivacy());
}

export function requireUnrestrictedNetwork(): void {
	if (active) throw new Error('This feature is unavailable while Privacy Mode is on.');
}
