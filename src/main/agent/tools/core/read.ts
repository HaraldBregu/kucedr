import { readFileBounded } from '../../files/read';
import { authorizeFilePath } from '../../files/authorize';
import { z } from 'zod';
import { tool } from '../tool';

export const readTool = tool({
	id: 'read',
	category: 'core',
	name: 'Read file',
	description:
		'Read the full UTF-8 contents of a single text file. Use this before editing when you need the current file contents.',
	planSafe: true,
	inputSchema: z.object({
		path: z
			.string()
			.min(1)
			.describe(
				'Path relative to the agent filesystem root, or an absolute path. ~ is the OS user home.'
			),
	}),
	execute: async ({ path: filePath }, signal) => {
		const resolved = authorizeFilePath(filePath);
		return (await readFileBounded(resolved, 2 * 1024 * 1024, signal)).toString('utf8');
	},
});
