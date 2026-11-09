import { readFileBounded } from '../../files/read';
import { authorizeFilePath } from '../../files/authorize';
import { z } from 'zod';
import { tool } from '../tool';

export const readTool = tool({
	id: 'read',
	category: 'core',
	name: 'Read file',
	description:
		'Read the UTF-8 contents of a single text file. Use this before editing when you need the current file contents. Pass offset and limit to read only part of a large file instead of using bash.',
	readOnly: true,
	inputSchema: z.object({
		path: z
			.string()
			.min(1)
			.describe(
				'Path relative to the agent filesystem root, or an absolute path. ~ is the OS user home.'
			),
		offset: z.number().int().min(1).optional().describe('First line to read, 1-based.'),
		limit: z.number().int().min(1).optional().describe('Maximum number of lines to read.'),
	}),
	execute: async ({ path: filePath, offset, limit }, signal) => {
		const resolved = authorizeFilePath(filePath);
		const text = (await readFileBounded(resolved, 2 * 1024 * 1024, signal)).toString('utf8');
		if (offset === undefined && limit === undefined) return text;
		const start = (offset ?? 1) - 1;
		return text
			.split('\n')
			.slice(start, limit === undefined ? undefined : start + limit)
			.join('\n');
	},
});
