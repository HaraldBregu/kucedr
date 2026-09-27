import { lstat } from 'node:fs/promises';
import path from 'node:path';
import type { CodingProject } from '../../shared/coding_types';
import { isCodingMarkdownFileName } from '../../shared/coding_types';
import { atomicWrite } from '../shared/atomic_write';
import { markdownLocation } from './context_location';
import { readMarkdownFile } from './load';

export async function saveMarkdownFile(
	project: CodingProject,
	fileName: string,
	content: string,
	expectedContent: string
): Promise<void> {
	if (!isCodingMarkdownFileName(fileName)) throw new Error('Invalid coding Markdown file.');
	if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024)
		throw new Error('Markdown files are limited to 2 MB.');
	const candidate = path.join(markdownLocation(project), fileName);
	const status = await lstat(candidate);
	if (!status.isFile()) throw new Error('Only regular Markdown files can be saved.');
	if ((await readMarkdownFile(project, fileName)) !== expectedContent)
		throw new Error('Markdown file changed outside Kucedr. Reload before saving.');
	await atomicWrite(candidate, content);
}
