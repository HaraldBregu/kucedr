import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { WorkspaceRecord } from '../../shared/workspaces_types';
import { aside } from '../browser/aside';
import { workspacesFile } from './file';

const record = z.object({
	id: z.string().uuid(),
	name: z.string().trim().min(1).max(64),
	folder: z.string().refine((folder) => path.isAbsolute(folder)),
	image: z.string().optional(),
});

export function readWorkspaces(): WorkspaceRecord[] {
	const file = workspacesFile();
	for (const candidate of [file, `${file}.bak`]) {
		let content: string;
		try {
			content = readFileSync(candidate, 'utf8');
		} catch {
			continue;
		}
		try {
			const { workspaces } = z
				.object({ workspaces: z.array(z.unknown()) })
				.parse(JSON.parse(content));
			return workspaces.flatMap((entry) => {
				const parsed = record.safeParse(entry);
				return parsed.success ? [parsed.data] : [];
			});
		} catch {
			if (candidate === file) aside(file);
		}
	}
	return [];
}
