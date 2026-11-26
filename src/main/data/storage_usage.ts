import fs from 'node:fs/promises';
import path from 'node:path';
import type { StorageUsage } from '../../shared/data_types';

export async function readStorageUsage(root: string): Promise<StorageUsage> {
	const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
	const areas: StorageUsage['areas'] = [];
	let otherBytes = 0;
	let totalBytes = 0;

	const sizeOf = async (target: string): Promise<number> => {
		const stat = await fs.lstat(target).catch(() => undefined);
		if (!stat || stat.isSymbolicLink()) return 0;
		if (stat.isFile()) return stat.size;
		if (!stat.isDirectory()) return 0;
		const children = await fs.readdir(target, { withFileTypes: true }).catch(() => []);
		const sizes = await Promise.all(children.map((child) => sizeOf(path.join(target, child.name))));
		return sizes.reduce((sum, size) => sum + size, 0);
	};

	for (const entry of entries) {
		const entryPath = path.join(root, entry.name);
		const bytes = await sizeOf(entryPath);
		totalBytes += bytes;
		if (entry.isDirectory()) areas.push({ name: entry.name, bytes });
		else otherBytes += bytes;
	}
	if (otherBytes > 0) areas.push({ name: 'other', bytes: otherBytes });
	areas.sort((left, right) => right.bytes - left.bytes);
	return { areas, totalBytes };
}
