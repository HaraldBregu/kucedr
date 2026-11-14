import { z } from 'zod';
import { tool } from '../tool';
import { writeAuthorizedFile } from '../../files/write';
import { removeAuthorizedFile } from '../../files/remove';
import { readFileBounded } from '../../files/read';
import { authorizeFilePath } from '../../files/authorize';

import { parsePatch } from './patch/parse';
import { applyUpdateChunks } from './patch/update';
import { MAX_READ_BYTES } from './limit';

export const applyPatchTool = tool({
	id: 'patch',
	category: 'core',
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
		const files = new Map<string, string | null>();
		const exists = (target: string): boolean => (files.has(target) ? files.get(target) !== null : existsSync(target));

		for (const hunk of hunks) {
			const target = authorizeFilePath(hunk.path);
			if (hunk.kind === 'add') {
				files.set(target, hunk.contents);
				added.push(target);
			} else if (hunk.kind === 'delete') {
				if (!exists(target)) throw new Error(`File to delete does not exist: ${target}`);
				files.set(target, null);
				deleted.push(target);
			} else {
				if (!exists(target)) throw new Error(`File to update does not exist: ${target}`);
				const contents =
					files.get(target) ?? decodeUtf8(await readFileBounded(target, MAX_READ_BYTES, signal), target);
				const applied = applyUpdateChunks(target, contents, hunk.chunks);
				if (hunk.movePath) {
					const moveTarget = authorizeFilePath(hunk.movePath);
					if (moveTarget !== target) files.set(target, null);
					files.set(moveTarget, applied);
					modified.push(moveTarget);
				} else {
					files.set(target, applied);
					modified.push(target);
				}
			}
		}

		signal?.throwIfAborted();
		for (const [target, contents] of files) {
			if (contents !== null) await writeAuthorizedFile(target, contents, signal);
			else if (existsSync(target)) await removeAuthorizedFile(target, signal);
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
