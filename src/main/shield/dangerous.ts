import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resourceRoot } from '../shared/resource_root';

let hosts: Set<string> | undefined;

export function dangerous(hostname: string): boolean {
	if (!hosts) {
		const text = readFileSync(path.join(resourceRoot(), 'resources/shield/urlhaus.txt'), 'utf8');
		const names = text
			.split(/\r?\n/)
			.map((line) => line.trim().toLowerCase())
			.filter((line) => line && !line.startsWith('#'));
		if (names.length === 0) throw new Error('The dangerous site list is empty.');
		hosts = new Set(names);
	}
	return hosts.has(
		hostname
			.toLowerCase()
			.replace(/^\[(.*)\]$/, '$1')
			.replace(/\.+$/, '')
	);
}
