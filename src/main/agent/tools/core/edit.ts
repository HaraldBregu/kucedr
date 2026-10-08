import { z } from 'zod';
import { tool } from '../tool';
import { writeAuthorizedFile } from '../../files/write';
import { readFileBounded } from '../../files/read';
import { authorizeFilePath } from '../../files/authorize';

export const editTool = tool({
	id: 'edit',
	category: 'core',
	name: 'Edit file',
	description:
		'Edit a UTF-8 text file by replacing one exact text match. Use this for focused changes when the old text appears exactly once.',
	inputSchema: z.object({
		path: z
			.string()
			.min(1)
			.describe(
				'Path relative to the agent filesystem root, or an absolute path. ~ is the OS user home.'
			),
		oldText: z.string().min(1).describe('Exact text to replace.'),
		newText: z.string().describe('Replacement text.'),
	}),
	execute: async ({ path: filePath, oldText, newText }, signal) => {
		const resolved = authorizeFilePath(filePath);
		const content = (await readFileBounded(resolved, 2 * 1024 * 1024, signal)).toString('utf8');
		const firstIndex = content.indexOf(oldText);
		if (firstIndex === -1) {
			throw new Error('edit oldText was not found.');
		}
		if (content.indexOf(oldText, firstIndex + oldText.length) !== -1) {
			throw new Error('edit oldText matched multiple locations.');
		}

		await writeAuthorizedFile(resolved, content.replace(oldText, newText), signal);
		return { path: resolved };
	},
});
