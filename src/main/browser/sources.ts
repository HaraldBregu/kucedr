import { existsSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface SourceProfile {
	readonly id: string;
	readonly browser: string;
	readonly profile: string;
	readonly kind: 'chromium' | 'firefox';
	readonly directory: string;
}

const CHROMIUM: Record<string, Partial<Record<NodeJS.Platform, string>>> = {
	Chrome: {
		darwin: 'Library/Application Support/Google/Chrome',
		win32: 'AppData/Local/Google/Chrome/User Data',
		linux: '.config/google-chrome',
	},
	Edge: {
		darwin: 'Library/Application Support/Microsoft Edge',
		win32: 'AppData/Local/Microsoft/Edge/User Data',
		linux: '.config/microsoft-edge',
	},
	Brave: {
		darwin: 'Library/Application Support/BraveSoftware/Brave-Browser',
		win32: 'AppData/Local/BraveSoftware/Brave-Browser/User Data',
		linux: '.config/BraveSoftware/Brave-Browser',
	},
	Vivaldi: {
		darwin: 'Library/Application Support/Vivaldi',
		win32: 'AppData/Local/Vivaldi/User Data',
		linux: '.config/vivaldi',
	},
	Arc: { darwin: 'Library/Application Support/Arc/User Data' },
	Chromium: {
		darwin: 'Library/Application Support/Chromium',
		win32: 'AppData/Local/Chromium/User Data',
		linux: '.config/chromium',
	},
};
const FIREFOX: Partial<Record<NodeJS.Platform, string>> = {
	darwin: 'Library/Application Support/Firefox/Profiles',
	win32: 'AppData/Roaming/Mozilla/Firefox/Profiles',
	linux: '.mozilla/firefox',
};

export function browserSources(): SourceProfile[] {
	const found: SourceProfile[] = [];
	const folders = (root: string): string[] => {
		try {
			return readdirSync(root, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name);
		} catch {
			return [];
		}
	};
	for (const [browser, locations] of Object.entries(CHROMIUM)) {
		const location = locations[process.platform];
		if (!location) continue;
		const root = path.join(os.homedir(), location);
		for (const name of folders(root)) {
			const directory = path.join(root, name);
			if (!/^(Default|Profile \d+)$/.test(name) || !existsSync(path.join(directory, 'Preferences'))) continue;
			let profile = name;
			try {
				const preferences = JSON.parse(readFileSync(path.join(directory, 'Preferences'), 'utf8')) as {
					profile?: { name?: string };
					account_info?: { email?: string }[];
				};
				profile = [preferences.profile?.name || name, preferences.account_info?.[0]?.email || name].join(' · ');
			} catch {
				// keep the folder name
			}
			found.push({ id: `${browser}:${name}`, browser, profile, kind: 'chromium', directory });
		}
	}
	const firefox = FIREFOX[process.platform];
	if (firefox) {
		const root = path.join(os.homedir(), firefox);
		for (const name of folders(root)) {
			const directory = path.join(root, name);
			if (!existsSync(path.join(directory, 'places.sqlite'))) continue;
			found.push({
				id: `Firefox:${name}`,
				browser: 'Firefox',
				profile: name.replace(/^[^.]+\./, ''),
				kind: 'firefox',
				directory,
			});
		}
	}
	return found;
}
