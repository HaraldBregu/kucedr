import { z } from 'zod';
import { tool } from '../tool';
import { writeAuthorizedFile } from '../../files/write';
import { removeAuthorizedFile } from '../../files/remove';
import { readFileBounded } from '../../files/read';
import { authorizeFilePath } from '../../files/authorize';

import { parsePatch } from './patch/parse';
import { applyUpdateChunks } from './patch/update';

export const applyPatchTool = tool({
	id: 'patch',
	name: 'Apply patch',
	description:
		'Apply a multi-file patch using the *** Begin Patch/*** End Patch format. Supports Add File, Delete File, and Update File (with optional Move to) hunks.',
	inputSchema: z.object({
		input: z.string().min(1).describe('Patch content using the *** Begin Patch/End Patch format.'),
	}),
	execute: async ({ input }, signal) => {
		const hunks = parsePatch(input);
		const added: string[] = [];
		const modified: string[] = [];
		const deleted: string[] = [];

		for (const hunk of hunks) {
			const target = authorizeFilePath(hunk.path);
			if (hunk.kind === 'add') {
				await writeAuthorizedFile(target, hunk.contents, signal);
				added.push(target);
			} else if (hunk.kind === 'delete') {
				await removeAuthorizedFile(target, signal);
				deleted.push(target);
			} else {
				const contents = (await readFileBounded(target, 2 * 1024 * 1024, signal)).toString('utf8');
				const applied = applyUpdateChunks(target, contents, hunk.chunks);
				if (hunk.movePath) {
					const moveTarget = authorizeFilePath(hunk.movePath);
					await writeAuthorizedFile(moveTarget, applied, signal);
					if (moveTarget !== target) await removeAuthorizedFile(target, signal);
					modified.push(moveTarget);
				} else {
					await writeAuthorizedFile(target, applied, signal);
					modified.push(target);
				}
			}
		}

		return {
			summary: [
				...added.map((f) => `A ${f}`),
				...modified.map((f) => `M ${f}`),
				...deleted.map((f) => `D ${f}`),
			].join('\n'),
		};
	},
});
