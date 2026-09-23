import { promises as fs } from 'node:fs';
import path from 'node:path';
import { storageLocation } from './paths';

export async function writeStorageLog(
	event: 'published' | 'pending-retry' | 'caught-up',
	count: number
): Promise<void> {
	const directory = path.join(storageLocation(), 'logs');
	await fs.mkdir(directory, { recursive: true, mode: 0o700 });
	const file = path.join(directory, 'sync.log');
	let size = 0;
	try {
		size = (await fs.stat(file)).size;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	if (size >= 1_048_576) await fs.writeFile(file, '', { mode: 0o600 });
	await fs.appendFile(file, `${new Date().toISOString()} ${event} ${Math.max(0, count)}\n`, {
		mode: 0o600,
	});
}
