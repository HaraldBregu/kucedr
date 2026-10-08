import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function preserveRestoreTarget(target: string, root: string): Promise<void> {
	try {
		const stat = await fs.lstat(target);
		if (!stat.isFile() || stat.isSymbolicLink())
			throw new Error('Restore target is not a regular file.');
		const relative = path.relative(root, target);
		const recovery = path.join(root, '.kucedr-recovery', randomUUID(), relative);
		await fs.mkdir(path.dirname(recovery), { recursive: true });
		await fs.copyFile(target, recovery, fs.constants.COPYFILE_EXCL);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
}
