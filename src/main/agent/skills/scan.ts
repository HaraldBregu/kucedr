import fs from 'node:fs';
import path from 'node:path';
import { SKILL_FILE, SKILL_PACKAGE_MAX_DEPTH } from './skills_limits';

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'out']);

export function scanSkillFolders(root: string): string[] {
	if (!fs.existsSync(root)) return [];
	const folders: string[] = [];
	const pending = [{ folder: path.resolve(root), depth: 0 }];
	while (pending.length > 0) {
		const current = pending.pop() as { folder: string; depth: number };
		let entries: fs.Dirent[];
		try {
			entries = fs
				.readdirSync(current.folder, { withFileTypes: true })
				.sort((left, right) => left.name.localeCompare(right.name));
		} catch {
			continue;
		}
		if (
			entries.some(
				(entry) =>
					entry.name === SKILL_FILE && (entry.isFile() || entry.isSymbolicLink())
			)
		) {
			folders.push(current.folder);
			continue;
		}
		if (current.depth >= SKILL_PACKAGE_MAX_DEPTH) continue;
		for (const entry of [...entries].reverse()) {
			if (
				!entry.isDirectory() ||
				entry.name.startsWith('.import-') ||
				IGNORED_DIRECTORIES.has(entry.name)
			)
				continue;
			pending.push({ folder: path.join(current.folder, entry.name), depth: current.depth + 1 });
		}
	}
	return folders.sort((left, right) => left.localeCompare(right));
}
