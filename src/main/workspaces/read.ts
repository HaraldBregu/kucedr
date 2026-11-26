import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { WorkspaceRecord } from '../../shared/workspaces_types';
import { workspacesFile } from './file';

const record = z.object({
	id: z.string().uuid(),
	name: z.string().trim().min(1).max(64),
	folder: z.string().refine((folder) => path.isAbsolute(folder)),
	image: z.string().optional(),
});

export function readWorkspaces(): WorkspaceRecord[] {
	let content: string;
	try {
		content = readFileSync(workspacesFile(), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
	const { workspaces } = z.object({ workspaces: z.array(z.unknown()) }).parse(JSON.parse(content));
	return workspaces.flatMap((entry) => {
		const parsed = record.safeParse(entry);
		return parsed.success ? [parsed.data] : [];
	});
}
