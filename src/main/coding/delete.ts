import { lstat, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { CodingProject } from '../../shared/coding_types';
import { isCodingMarkdownFileName } from '../../shared/coding_types';
import { markdownLocation } from './context_location';

export async function deleteMarkdownFile(project: CodingProject, fileName: string): Promise<void> {
	if (!isCodingMarkdownFileName(fileName)) throw new Error('Invalid coding Markdown file.');
	const candidate = path.join(markdownLocation(project), fileName);
	const status = await lstat(candidate);
	if (!status.isFile()) throw new Error('Only regular Markdown files can be deleted.');
	await unlink(candidate);
}
