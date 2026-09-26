import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadProjectContextFiles } from '@earendil-works/pi-coding-agent';
import type { CoderHarness } from '../../shared/coding_types';
import { userDataLocation } from '../shared/user_data_location';

export function loadInstructionSources(
	cwd: string,
	runtime: CoderHarness,
	piDirectory: string
): { path: string }[] {
	if (runtime === 'pi') return loadProjectContextFiles({ cwd, agentDir: piDirectory });
	if (runtime === 'claude')
		return existsSync(path.join(cwd, 'CLAUDE.md')) ? [{ path: path.join(cwd, 'CLAUDE.md') }] : [];
	const sources: { path: string }[] = [];
	const global = path.join(userDataLocation(), 'coder', 'codex', 'AGENTS.md');
	if (existsSync(global)) sources.push({ path: global });
	const parents: string[] = [];
	for (let current = cwd; ; current = path.dirname(current)) {
		parents.unshift(current);
		if (path.dirname(current) === current) break;
	}
	for (const directory of parents) {
		const file = ['AGENTS.override.md', 'AGENTS.md']
			.map((name) => path.join(directory, name))
			.find((name) => existsSync(name));
		if (file) sources.push({ path: file });
	}
	return sources;
}
