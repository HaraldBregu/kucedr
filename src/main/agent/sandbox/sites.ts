import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SITE_HOST, type CommandSites } from '../../../shared/sites';
import { writeFileAtomic } from '../../browser/write';
import { userDataLocation } from '../../shared/user_data_location';

const file = path.join(userDataLocation(), 'settings', 'sites.json');

let sites: CommandSites = { strict: false, hosts: [] };
try {
	const saved = JSON.parse(readFileSync(file, 'utf8')) as Partial<CommandSites>;
	sites = {
		strict: saved.strict === true,
		hosts: Array.isArray(saved.hosts) ? saved.hosts.filter((host) => SITE_HOST.test(host)) : [],
	};
} catch {
	// A missing file leaves commands free to reach any public site, as before the list existed.
}

// Hosts approved for each running command, by command id.
export const opened = new Map<string, readonly string[]>();
// Hosts refused since the last command output was annotated.
export const refused = new Set<string>();

export const siteHost = (host: string): string => host.trim().toLowerCase().replace(/\.+$/, '');

export const covers = (entries: readonly string[], host: string): boolean =>
	entries.some((entry) => host === entry || host.endsWith(`.${entry}`));

export const getSites = (): CommandSites => sites;

export const listed = (host: string): boolean => !sites.strict || covers(sites.hosts, siteHost(host));

export function setSites(next: CommandSites): CommandSites {
	if (typeof next?.strict !== 'boolean' || !Array.isArray(next.hosts)) throw new Error('Invalid site list.');
	const hosts = [...new Set(next.hosts.map(siteHost))];
	const bad = hosts.find((host) => !SITE_HOST.test(host));
	if (bad !== undefined) throw new Error(`Enter a site name like example.com, not "${bad}".`);
	sites = { strict: next.strict, hosts };
	mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	writeFileAtomic(file, JSON.stringify(sites));
	return sites;
}
