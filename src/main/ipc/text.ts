import fs from 'node:fs/promises';

import { resolveWorkspaceFile } from './workspace';

export async function readWorkspaceTextFile(root: string, filePath: string): Promise<string> {
	const resolvedPath = await resolveWorkspaceFile(root, filePath);
	const stats = await fs.stat(resolvedPath);
	if (!stats.isFile()) throw new Error('Workspace path is not a file.');
	const content = await fs.readFile(resolvedPath);
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(content);
	} catch {
		throw new Error('This binary file cannot be displayed as code.');
	}
}
