import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { storageLocation } from '../local/paths';
import { storageTarget } from '../storage_target';

export async function installNewWorkingFile(
	root: string,
	relativePath: string,
	content: Uint8Array
): Promise<boolean> {
	const target = await storageTarget(root, relativePath, '');
	await fs.mkdir(path.dirname(target), { recursive: true });
	await storageTarget(root, relativePath, '');
	const staging = path.join(storageLocation(), 'staging');
	await fs.mkdir(staging, { recursive: true, mode: 0o700 });
	const temporary = path.join(staging, randomUUID());
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
			if (['EEXIST', 'EXDEV'].includes((error as NodeJS.ErrnoException).code ?? '')) {
				return false;
			}
			throw error;
		}
		const directory = await fs.open(path.dirname(target), 'r');
		try {
			await directory.sync();
		} finally {
			await directory.close();
		}
		return true;
	} finally {
		await fs.rm(temporary, { force: true });
	}
}
