import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resourceRoot } from '../shared/resource_root';

const RULE = /^(@@)?\|\|([a-z0-9.-]+)\^(?:\$(.*))?$/;

let hosts: { block: Set<string>; allow: Set<string> } | undefined;

export function list(): { block: Set<string>; allow: Set<string> } {
	if (hosts) return hosts;
	const block = new Set<string>();
	const allow = new Set<string>();
	const text = readFileSync(path.join(resourceRoot(), 'resources/shield/easyprivacy.txt'), 'utf8');
	for (const line of text.split(/\r?\n/)) {
		const rule = RULE.exec(line.trim().toLowerCase());
		if (!rule) continue;
		const options = rule[3]?.split(',') ?? [];
		if (rule[1]) {
			if (!options.some((option) => option.startsWith('domain=') || option === '~third-party')) allow.add(rule[2]);
		} else if (options.every((option) => option === 'third-party' || option === '3p')) block.add(rule[2]);
	}
	if (block.size === 0) throw new Error('The tracker list is empty.');
	hosts = { block, allow };
	return hosts;
}
