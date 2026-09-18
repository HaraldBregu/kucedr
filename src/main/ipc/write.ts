import fs from 'node:fs/promises';

import { workspaceFileType, type WorkspaceFileKind } from '../../shared/workspace';
import { atomicWrite } from '../shared/atomic_write';
import { resolveWorkspaceFile } from './workspace';

const editableKinds = new Set<WorkspaceFileKind>([
	'markdown',
	'mermaid',
	'excalidraw',
	'tldraw',
	'text',
]);

export async function writeWorkspaceFile(
	root: string,
	filePath: string,
	content: string
): Promise<void> {
	const resolvedPath = await resolveWorkspaceFile(root, filePath);
	const stats = await fs.stat(resolvedPath);
	if (!stats.isFile()) throw new Error('Workspace path is not a file.');
	if (!editableKinds.has(workspaceFileType(resolvedPath).kind)) {
		throw new Error('Workspace file type cannot be edited.');
	}
	await atomicWrite(resolvedPath, content);
}
