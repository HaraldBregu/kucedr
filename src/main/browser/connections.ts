import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserConnections } from '../../shared/browser';
import { userDataLocation } from '../shared/user_data_location';
import { writeFileAtomic } from './write';

let cached: BrowserConnections | undefined;

export function connections(next?: BrowserConnections): BrowserConnections {
	const file = path.join(userDataLocation(), 'browser', 'connections.json');
	if (next) {
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileAtomic(file, JSON.stringify(next));
		cached = next;
	}
	if (!cached) {
		const empty: BrowserConnections = { tor: '', proxy: '' };
		try {
			const saved = JSON.parse(readFileSync(file, 'utf8')) as Partial<BrowserConnections>;
			cached = {
				tor: typeof saved.tor === 'string' ? saved.tor : '',
				proxy: typeof saved.proxy === 'string' ? saved.proxy : '',
			};
		} catch {
			cached = empty;
		}
	}
	return cached;
}
