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

	return path.resolve(fs.realpathSync.native(existingPath), ...missingSegments);
}
