import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resourceRoot } from '../shared/resource_root';

const RULE = /^(@@)?\|\|([a-z0-9.-]+)\^(?:\$(.*))?$/;
export const KINDS = [
	'script',
	'image',
	'stylesheet',
	'object',
	'xmlhttprequest',
	'subdocument',
	'ping',
	'websocket',
	'font',
	'media',
	'other',
];

type Hosts = Map<string, Set<string>>;

let hosts: { block: Hosts; allow: Hosts } | undefined;

export function list(): { block: Hosts; allow: Hosts } {
	if (hosts) return hosts;
	const block: Hosts = new Map();
	const allow: Hosts = new Map();
	const text = readFileSync(path.join(resourceRoot(), 'resources/shield/easyprivacy.txt'), 'utf8');
	for (const line of text.split(/\r?\n/)) {
		const rule = RULE.exec(line.trim().toLowerCase());
		if (!rule) continue;
		const options = (rule[3]?.split(',') ?? []).filter((option) => option !== 'third-party' && option !== '3p');
		const kinds = options.filter((option) => KINDS.includes(option));
		const without = options.filter((option) => KINDS.includes(option.slice(1)) && option.startsWith('~'));
		if (kinds.length + without.length !== options.length || (kinds.length && without.length)) continue;
		const applies = kinds.length ? kinds : KINDS.filter((kind) => !without.includes(`~${kind}`));
		const target = rule[1] ? allow : block;
		target.set(rule[2], new Set([...(target.get(rule[2]) ?? []), ...applies]));
	}
	if (block.size === 0) throw new Error('The tracker list is empty.');
	hosts = { block, allow };
	return hosts;
}
