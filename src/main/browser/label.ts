import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PROFILE_FILES } from './formats';

const CONTAINER = /^(user data|profiles?)$/i;
const SETTINGS_FILE = Object.keys(PROFILE_FILES).find((name) => PROFILE_FILES[name].includes('settings')) ?? '';

// Names a profile from where it lives: the application from the folders above it, the
// profile from its own folder, or from the name the browser saved for it when there is one.
export function label(root: string, directory: string): { app: string; profile: string } {
	const parts = path.relative(root, directory).split(path.sep).filter(Boolean);
	const folder = parts.pop() ?? path.basename(directory);
	const above = parts.filter((part) => !CONTAINER.test(part)).at(-1);
	const pretty = (name: string): string => {
		const plain = name.replace(/^\./, '');
		const last = /^[\w-]+(\.[\w-]+){2,}$/.test(plain) ? (plain.split('.').at(-1) ?? plain) : plain;
		return last
			.split(/[-_\s]+/)
			.filter(Boolean)
			.map((word) => (word === word.toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word))
			.join(' ');
	};
	let profile = above ? folder.replace(/^[a-z0-9]{8}\./i, '') : '';
	try {
		const saved = JSON.parse(readFileSync(path.join(directory, SETTINGS_FILE), 'utf8')) as {
			profile?: { name?: string };
			account_info?: { email?: string }[];
		};
		profile = [saved.profile?.name || profile, saved.account_info?.[0]?.email].filter(Boolean).join(' · ');
	} catch {
		// no saved name; the folder name stands
	}
	return { app: pretty(above ?? folder), profile };
}
