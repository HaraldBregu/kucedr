import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CodingProject } from '../../shared/coding_types';
import { isCodingMarkdownFileName } from '../../shared/coding_types';
import { markdownLocation } from './context_location';

export async function createMarkdownFile(project: CodingProject, fileName: string): Promise<void> {
	if (!isCodingMarkdownFileName(fileName)) throw new Error('Invalid coding Markdown file.');
	const directory = markdownLocation(project);
	await mkdir(directory, { recursive: true });
	await writeFile(path.join(directory, fileName), '', { encoding: 'utf8', flag: 'wx' });
}
