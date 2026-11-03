import { existsSync } from 'node:fs';
import path from 'node:path';

export function loadInstructionSources(cwd: string, agentDirectory: string): { path: string }[] {
	const sources: { path: string }[] = [];
	const global = path.join(agentDirectory, 'AGENTS.md');
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
