import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resourceRoot } from '../shared/resource_root';

let names: Set<string> | undefined;

export function hosts(): Set<string> {
	if (names) return names;
	const text = readFileSync(path.join(resourceRoot(), 'resources/shield/urlhaus.txt'), 'utf8');
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim().toLowerCase())
		.filter((line) => line && !line.startsWith('#'));
	if (lines.length === 0) throw new Error('The dangerous site list is empty.');
	names = new Set(lines);
	return names;
}
