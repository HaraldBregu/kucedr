import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { CodingProject } from '../../shared/coding_types';

export async function listMarkdownFiles(project: CodingProject): Promise<string[]> {
	const files: string[] = [];
	const visit = async (directory: string, prefix = ''): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (files.length >= 1_000) return;
			if (entry.isDirectory() && !['.git', 'node_modules', 'dist', 'out'].includes(entry.name)) {
				await visit(path.join(directory, entry.name), path.posix.join(prefix, entry.name));
			} else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
				files.push(path.posix.join(prefix, entry.name));
			}
		}
	};
	await visit(project.directory);
	return files.sort((left, right) => left.localeCompare(right));
}
