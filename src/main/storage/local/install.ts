import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { storageLocation } from './paths';
import type { StorageScope } from './types';

export async function installVerifiedDownload(
	scope: StorageScope,
	content: Uint8Array,
	expectedHash: string
): Promise<string> {
	if (!/^[0-9a-f]{64}$/.test(expectedHash) ||
		createHash('sha256').update(content).digest('hex') !== expectedHash) {
		throw new Error('Downloaded content failed SHA-256 verification.');
	}
	const scopeHash = createHash('sha256')
		.update(JSON.stringify([scope.accountId, scope.workspaceId])).digest('hex');
	const blobDir = path.join(storageLocation(), 'blobs', scopeHash);
	const stagingDir = path.join(storageLocation(), 'staging');
	const target = path.join(blobDir, expectedHash);
	await fs.mkdir(blobDir, { recursive: true, mode: 0o700 });
	await fs.mkdir(stagingDir, { recursive: true, mode: 0o700 });
	const temporary = path.join(stagingDir, randomUUID());
	try {
		const handle = await fs.open(temporary, 'wx', 0o600);
		try {
			await handle.writeFile(content);
			await handle.sync();
		} finally {
			await handle.close();
		}
		try {
			await fs.link(temporary, target);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			const existing = await fs.readFile(target);
			if (createHash('sha256').update(existing).digest('hex') !== expectedHash) {
				throw new Error('Cached blob failed SHA-256 verification.');
			}
		}
		const dir = await fs.open(blobDir, 'r');
		try {
			await dir.sync();
		} finally {
			await dir.close();
		}
		return target;
	} finally {
		await fs.rm(temporary, { force: true });
	}
}
