import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { CodingProject } from '../../shared/coding_types';

export async function readProjectFile(project: CodingProject, filePath: string): Promise<string> {
	const root = await realpath(project.directory);
	const target = await realpath(path.resolve(root, filePath));
	const relative = path.relative(root, target);
	if (
		!relative ||
		relative === '..' ||
		relative.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relative)
	) {
		throw new Error('Coding files must stay inside the project directory.');
	}
	const file = await open(target, 'r');
	try {
		const stats = await file.stat();
		if (!stats.isFile()) throw new Error('Only regular files can be previewed.');
		if (stats.size > 2 * 1024 * 1024) throw new Error('File preview is limited to 2 MB.');
		const buffer = Buffer.alloc(2 * 1024 * 1024 + 1);
		const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
		if (bytesRead > 2 * 1024 * 1024) throw new Error('File preview is limited to 2 MB.');
		const content = buffer.subarray(0, bytesRead);
		if (content.includes(0)) throw new Error('Binary files cannot be previewed.');
		return new TextDecoder('utf-8', { fatal: true }).decode(content);
	} finally {
		await file.close();
	}
}
