import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';
import type { CodingProject } from '../../shared/coding_types';
import { isCodingMarkdownFileName } from '../../shared/coding_types';
import { markdownLocation } from './context_location';

export async function readMarkdownFile(project: CodingProject, fileName: string): Promise<string> {
	if (!isCodingMarkdownFileName(fileName)) throw new Error('Invalid coding Markdown file.');
	const file = await open(
		path.join(markdownLocation(project), fileName),
		constants.O_RDONLY | constants.O_NOFOLLOW
	);
	try {
		const stats = await file.stat();
		if (!stats.isFile()) throw new Error('Only regular Markdown files can be opened.');
		if (stats.size > 2 * 1024 * 1024) throw new Error('Markdown files are limited to 2 MB.');
		return await file.readFile({ encoding: 'utf8' });
	} finally {
		await file.close();
	}
}
