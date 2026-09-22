import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CodingProject, CodingProjectFile } from '../../shared/coding_types';

const MAX_ENTRIES = 1_000;

export async function listProjectFiles(project: CodingProject): Promise<CodingProjectFile[]> {
	const entries: CodingProjectFile[] = [];
	const visit = async (directory: string, prefix = ''): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (entries.length >= MAX_ENTRIES) return;
			const relativePath = path.posix.join(prefix, entry.name);
			if (entry.isDirectory()) {
				entries.push({ path: relativePath, type: 'directory' });
				await visit(path.join(directory, entry.name), relativePath);
			} else if (entry.isFile()) {
				entries.push({ path: relativePath, type: 'file' });
			}
		}
	};
	await visit(project.directory);
	return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export async function createProjectFile(
	project: CodingProject,
	filePath: string
): Promise<CodingProjectFile> {
	const normalizedPath = filePath.trim().replaceAll('\\', '/');
	const targetPath = path.resolve(project.directory, normalizedPath);
	const relative = path.relative(project.directory, targetPath);
	if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error('Coding files must stay inside the project directory.');
	}
	await mkdir(path.dirname(targetPath), { recursive: true });
	await writeFile(targetPath, '', { encoding: 'utf8', flag: 'wx' });
	return { path: relative.split(path.sep).join('/'), type: 'file' };
}
