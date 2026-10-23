import fs from 'node:fs/promises';
import path from 'node:path';

import { workspaceFileType } from '../../shared/workspace';
import { resolveWorkspaceFile } from './workspace';

export async function cleanWorkspaceAssets(
	root: string,
	documentPath: string,
	trash: (filePath: string) => Promise<void>
): Promise<number> {
	const resolvedRoot = await fs.realpath(root);
	const resolvedDocument = await resolveWorkspaceFile(root, documentPath);
	const directory = path.join(path.dirname(resolvedDocument), 'assets');
	const assets = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
	const referenced = new Set<string>();
	const entries = await fs.readdir(resolvedRoot, { recursive: true, withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isFile() || workspaceFileType(entry.name).kind !== 'markdown') continue;
		const content = await fs.readFile(path.join(entry.parentPath, entry.name), 'utf8');
		for (const [, link] of content.matchAll(/(?:\]\(|src=["'])([^)\s"']+)/g)) {
			if (/^([a-z][a-z\d+.-]*:|\/|#)/i.test(link)) continue;
			referenced.add(path.resolve(entry.parentPath, decodeURI(link)));
		}
	}
	let removed = 0;
	for (const asset of assets) {
		const assetPath = path.join(directory, asset.name);
		if (!asset.isFile() || referenced.has(assetPath)) continue;
		await trash(assetPath);
		removed += 1;
	}
	return removed;
}
