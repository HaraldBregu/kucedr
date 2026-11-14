import { z } from 'zod';
import { tool } from '../tool';
import { writeAuthorizedFile } from '../../files/write';
import { readFileBounded } from '../../files/read';
import { authorizeFilePath } from '../../files/authorize';
import { decodeUtf8 } from '../../files/text';
import { lineEnding } from '../../files/eol';
import { PATH_DESCRIPTION } from './fields';
import { MAX_READ_BYTES } from './limit';

export const editTool = tool({
	id: 'edit',
	category: 'core',
	name: 'Edit file',
	description:
		'Edit a UTF-8 text file by replacing one exact text match. Use this for focused changes when the old text appears exactly once.',
	inputSchema: z.object({
		path: z.string().min(1).describe(PATH_DESCRIPTION),
		oldText: z.string().min(1).describe('Exact text to replace.'),
		newText: z.string().describe('Replacement text.'),
	}),
	execute: async ({ path: filePath, oldText, newText }, signal) => {
		const resolved = authorizeFilePath(filePath);
		const original = decodeUtf8(await readFileBounded(resolved, MAX_READ_BYTES, signal), resolved);
		const eol = lineEnding(original);
		const [content, search, replacement] = [original, oldText, newText].map((text) =>
			eol === '\r\n' ? text.replaceAll('\r\n', '\n') : text
		);
		const firstIndex = content.indexOf(search);
		if (firstIndex === -1) {
			throw new Error('edit oldText was not found.');
		}
		if (content.indexOf(search, firstIndex + search.length) !== -1) {
			throw new Error('edit oldText matched multiple locations.');
		}

		const edited = content.slice(0, firstIndex) + replacement + content.slice(firstIndex + search.length);
		await writeAuthorizedFile(resolved, eol === '\r\n' ? edited.replaceAll('\n', '\r\n') : edited, signal);
		return { path: resolved };
	},
});
