import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { CodingProject } from '../../shared/coding_types';
import { atomicWrite } from '../shared/atomic_write';
import { readProjectFile } from './read';

export async function saveMarkdownFile(
	project: CodingProject,
	filePath: string,
	content: string,
	expectedContent: string
): Promise<void> {
	if (!filePath.toLowerCase().endsWith('.md')) throw new Error('Only Markdown files can be saved.');
	if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024)
		throw new Error('Markdown files are limited to 2 MB.');
	const root = await realpath(project.directory);
	const candidate = path.resolve(root, filePath);
	const relative = path.relative(root, candidate);
	if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
		throw new Error('Markdown files must stay inside the project directory.');
	const status = await lstat(candidate);
	if (!status.isFile()) throw new Error('Only regular Markdown files can be saved.');
	if ((await readProjectFile(project, filePath)) !== expectedContent)
		throw new Error('Markdown file changed outside Kucedr. Reload before saving.');
	await atomicWrite(candidate, content);
}
