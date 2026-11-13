import { z } from 'zod';
import { tool } from '../tool';
import { writeAuthorizedFile } from '../../files/write';
import { authorizeFilePath } from '../../files/authorize';
import { PATH_DESCRIPTION } from './fields';

export const writeTool = tool({
	id: 'write',
	category: 'core',
	name: 'Write file',
	description:
		'Create or overwrite a UTF-8 text file with exact content, creating parent directories when needed.',
	inputSchema: z.object({
		path: z.string().min(1).describe(PATH_DESCRIPTION),
		content: z.string().describe('UTF-8 text content to write.'),
	}),
	execute: async ({ path: filePath, content }, signal) => {
		const resolved = authorizeFilePath(filePath);
		await writeAuthorizedFile(resolved, content, signal);
		return { path: resolved };
	},
});
