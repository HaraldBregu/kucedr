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
		try {
			const original = fs.statSync(resolved);
			const stripped = fs.statSync(resolved.slice(firmlink.length));
			if (original.dev === stripped.dev && original.ino === stripped.ino)
				return path.resolve(resolved.slice(firmlink.length), ...missingSegments);
		} catch {
			return path.resolve(resolved, ...missingSegments);
		}
	}
	return path.resolve(resolved, ...missingSegments);
}
