import { readFileBounded } from '../../files/read';
import { readLines } from '../../files/lines';
import { decodeUtf8 } from '../../files/text';
import { authorizeFilePath } from '../../files/authorize';
import { z } from 'zod';
import { tool } from '../tool';
import { PATH_DESCRIPTION } from './fields';
import { MAX_READ_BYTES } from './limit';

export const readTool = tool({
	id: 'read',
	category: 'core',
	name: 'Read file',
	description:
		'Read the UTF-8 contents of a single text file. Use this before editing when you need the current file contents. Pass offset and limit to read only part of a large file instead of using bash.',
	readOnly: true,
	inputSchema: z.object({
		path: z.string().min(1).describe(PATH_DESCRIPTION),
		offset: z.number().int().min(1).optional().describe('First line to read, 1-based.'),
		limit: z.number().int().min(1).optional().describe('Maximum number of lines to read.'),
	}),
	execute: async ({ path: filePath, offset, limit }, signal) => {
		const resolved = authorizeFilePath(filePath);
		if (offset === undefined && limit === undefined)
			return decodeUtf8(await readFileBounded(resolved, MAX_READ_BYTES, signal), resolved);
		return readLines(resolved, (offset ?? 1) - 1, limit, MAX_READ_BYTES, signal);
	},
});
