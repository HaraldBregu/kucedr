import { readdir } from 'node:fs/promises';
import type { CodingProject } from '../../shared/coding_types';
import { markdownLocation } from './context_location';

export async function listMarkdownFiles(project: CodingProject): Promise<string[]> {
	try {
		const entries = await readdir(markdownLocation(project), { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
			.map((entry) => entry.name)
			.sort((left, right) => left.localeCompare(right));
	} catch (cause) {
		if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw cause;
	}
}
