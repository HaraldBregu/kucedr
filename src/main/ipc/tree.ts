import fs from 'node:fs/promises';
import path from 'node:path';
import type { WorkspaceTreeEntry } from '../../shared/agent_types';

const ignoredWorkspaceEntryNames = new Set([
	'.DS_Store',
	'.LSOverride',
	'.VolumeIcon.icns',
	'Icon\r',
	'Thumbs.db',
	'ehthumbs.db',
	'ehthumbs_vista.db',
	'desktop.ini',
]);
const ignoredWorkspaceDirectoryNames = new Set([
	'.AppleDouble',
	'.DocumentRevisions-V100',
	'.Spotlight-V100',
	'.TemporaryItems',
	'.Trashes',
	'.fseventsd',
	'$RECYCLE.BIN',
	'System Volume Information',
	'lost+found',
]);

export async function readWorkspaceTree(
	root: string,
	directory = root
): Promise<WorkspaceTreeEntry[]> {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const result: WorkspaceTreeEntry[] = [];

	for (const entry of entries) {
		if (
			ignoredWorkspaceEntryNames.has(entry.name) ||
			entry.name.startsWith('._') ||
			(entry.isDirectory() && ignoredWorkspaceDirectoryNames.has(entry.name))
		) {
			continue;
		}
		const absolutePath = path.join(directory, entry.name);
		const relativePath = path.relative(root, absolutePath) || entry.name;
		if (entry.isDirectory()) {
			result.push({
				name: entry.name,
				path: relativePath,
				type: 'directory',
				children: await readWorkspaceTree(root, absolutePath),
			});
			continue;
		}
		if (entry.isFile()) {
			const stats = await fs.stat(absolutePath);
			result.push({
				name: entry.name,
				path: relativePath,
				type: 'file',
				size: stats.size,
				createdAt: (stats.birthtimeMs > 0 ? stats.birthtime : stats.mtime).toISOString(),
				updatedAt: stats.mtime.toISOString(),
			});
		}
	}

	return result.sort((left, right) => {
		if (left.type !== right.type) return left.type === 'directory' ? -1 : 1;
		return left.name.localeCompare(right.name);
	});
}
