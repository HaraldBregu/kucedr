import fs from 'node:fs/promises';
import path from 'node:path';

import { workspaceFileType } from '../../shared/workspace';
import { resolveWorkspaceFile } from './workspace';
import { workspaceEntryName } from './workspace_name';

export async function importWorkspaceAsset(
	root: string,
	documentPath: string,
	name: string,
	data: Uint8Array
): Promise<string> {
	const normalizedName = workspaceEntryName(name).replace(/[\s()<>[\]]+/g, '-');
	if (!['image', 'audio', 'video', 'pdf'].includes(workspaceFileType(normalizedName).kind)) {
		throw new Error('Workspace file is not a supported asset.');
	}
	const directory = path.dirname(await resolveWorkspaceFile(root, documentPath));
	const extension = path.extname(normalizedName);
	const base = path.basename(normalizedName, extension);
	for (let index = 0; ; index += 1) {
		const fileName = index ? `${base}-${index}${extension}` : normalizedName;
		try {
			await fs.writeFile(path.join(directory, fileName), data, { flag: 'wx' });
			return `assets/${fileName}`;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		}
	}
}
