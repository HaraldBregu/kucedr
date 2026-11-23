import { readFileSync } from 'node:fs';
import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';
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

let cached: Visit[] | undefined;
let timer: NodeJS.Timeout | undefined;

export function history(next?: Visit[], now = false): Visit[] {
	const file = path.join(userDataLocation(), 'browser', 'history.json');
	const write = (): void => {
		clearTimeout(timer);
		timer = undefined;
		writeFileAtomic(file, JSON.stringify(cached));
	};
	if (next) {
		cached = [...next].sort((a, b) => b.last - a.last).slice(0, HISTORY_LIMIT);
		timer ??= setTimeout(write, DELAY_MS);
	}
	if (now && timer) write();
	if (!cached) {
		library();
		try {
			cached = JSON.parse(readFileSync(file, 'utf8')) as Visit[];
		} catch {
			aside(file);
			cached = [];
		}
	}
	return cached;
}
