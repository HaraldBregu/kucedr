import fs from 'node:fs';
import path from 'node:path';
import { SKILL_FILE, SKILL_RESOURCE_LIST_LIMIT } from './skills_limits';
import { resolveSkillResource } from './skills_resolve_resource';

export function listSkillResources(canonicalRoot: string): { resources: string[]; skipped: string[] } {
	const resources: string[] = [];
	const skipped: string[] = [];
	const pending = [''];
	while (pending.length > 0 && resources.length < SKILL_RESOURCE_LIST_LIMIT) {
		const relativeDirectory = pending.pop() as string;
		const directory = path.join(canonicalRoot, relativeDirectory);
		const entries = fs
			.readdirSync(directory, { withFileTypes: true })
			.sort((a, b) => a.name.localeCompare(b.name));
		for (const entry of entries) {
			const relativePath = path.join(relativeDirectory, entry.name);
			if (relativePath === SKILL_FILE) continue;
			if (entry.isDirectory()) {
				pending.push(relativePath);
				continue;
			}
			if (!entry.isFile() && !entry.isSymbolicLink()) continue;
			const published = relativePath.split(path.sep).join('/');
			try {
				resolveSkillResource(canonicalRoot, relativePath);
			} catch {
				skipped.push(published);
				continue;
			}
			resources.push(published);
			if (resources.length >= SKILL_RESOURCE_LIST_LIMIT) {
				resources[resources.length - 1] = '[additional resources omitted]';
				break;
			}
		}
	}
	return { resources: resources.sort(), skipped };
}
