import fs from 'node:fs';
import path from 'node:path';

export function realPath(targetPath: string): string {
	let existingPath = path.resolve(targetPath);
	const missingSegments: string[] = [];

	while (!fs.existsSync(existingPath)) {
		const parent = path.dirname(existingPath);
		if (parent === existingPath) return path.resolve(targetPath);
		missingSegments.unshift(path.basename(existingPath));
		existingPath = parent;
	}

	const resolved = fs.realpathSync.native(existingPath);
	const firmlink = '/System/Volumes/Data';
	if (process.platform === 'darwin' && resolved.startsWith(`${firmlink}/`)) {
		const stripped = resolved.slice(firmlink.length);
		const original = fs.statSync(resolved);
		const alias = fs.statSync(stripped, { throwIfNoEntry: false });
		if (alias && original.dev === alias.dev && original.ino === alias.ino)
			return path.resolve(fs.realpathSync.native(stripped), ...missingSegments);
	}
	return path.resolve(resolved, ...missingSegments);
}
