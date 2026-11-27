import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { WorkspaceInfo } from '../../shared/workspaces_types';
import { DEFAULT_WORKSPACE, DEFAULT_WORKSPACE_NAME } from '../../shared/workspaces_types';
import { workspaceImages } from './images';
import { readWorkspaces } from './read';
import { resolveWorkspace } from './resolve';

export function listWorkspaces(): WorkspaceInfo[] {
	return [
		{
			id: DEFAULT_WORKSPACE,
			name: DEFAULT_WORKSPACE_NAME,
			folder: resolveWorkspace(DEFAULT_WORKSPACE).files,
			missing: false,
		},
		...readWorkspaces().map((record) => ({
			id: record.id,
			name: record.name,
			folder: record.folder,
			missing: !existsSync(record.folder),
			...(record.image && path.basename(record.image) === record.image
				? {
						image: `local-resource://file${pathToFileURL(path.join(userDataLocation(), 'workspaces', 'images', record.image)).pathname}`,
					}
				: {}),
		})),
	];
}
