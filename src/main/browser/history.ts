import { readFileSync } from 'node:fs';
import path from 'node:path';
import { currentWorkspace } from '../workspaces/current';
import { aside } from './aside';
import { library } from './library';
import { writeFileAtomic } from './write';

export const HISTORY_LIMIT = 5_000;
const DELAY_MS = 2_000;

export interface Visit {
	url: string;
	title: string;
	visits: number;
	last: number;
}

const cached = new Map<string, Visit[]>();
const timers = new Map<string, NodeJS.Timeout>();

export function history(next?: Visit[], now = false): Visit[] {
	const file = path.join(currentWorkspace().browser, 'history.json');
	const write = (): void => {
		clearTimeout(timers.get(file));
		timers.delete(file);
		writeFileAtomic(file, seal(JSON.stringify(cached.get(file))));
	};
	if (next) {
		cached.set(
			file,
			[...next].sort((a, b) => b.last - a.last).slice(0, HISTORY_LIMIT)
		);
		if (!timers.has(file)) timers.set(file, setTimeout(write, DELAY_MS));
	}
	if (now && timers.has(file)) write();
	let list = cached.get(file);
	if (!list) {
		library();
		try {
			list = JSON.parse(readSealed(file)) as Visit[];
		} catch {
			aside(file);
			list = [];
		}
		cached.set(file, list);
	}
	return list;
}
