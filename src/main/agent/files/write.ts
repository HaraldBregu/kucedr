import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { authorizeFilePath } from './authorize';
import { validateFilePath } from './validate';
import { authorizedPaths } from '../permissions/access';

export async function writeAuthorizedFile(filePath: string, content: string, signal?: AbortSignal): Promise<void> {
	signal?.throwIfAborted();
	const target = authorizeFilePath(filePath);
	const grant = authorizedPaths.getStore()!.find((entry) => entry.path === target)!;
	await fs.mkdir(path.dirname(target), { recursive: true });
	const identities = validateFilePath(target, !grant.exists);
	const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
	const handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o666);
	try {
		if (grant.exists) await handle.chmod((await fs.lstat(target)).mode & 0o7777);
		await handle.writeFile(content, { encoding: 'utf8', signal });
		signal?.throwIfAborted();
		if (JSON.stringify(validateFilePath(target, !grant.exists)) !== JSON.stringify(identities))
			throw new Error('File path changed while preparing the write.');
		authorizeFilePath(target);
		if (grant.exists) await fs.rename(temporary, target);
		else
			await fs.link(temporary, target).catch(async (error: NodeJS.ErrnoException) => {
				if (!['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EXDEV'].includes(error.code ?? '')) throw error;
				await (await fs.open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW)).close();
				await fs.rename(temporary, target);
			});
	} finally {
		await handle.close();
		await fs.rm(temporary, { force: true }).catch(() => undefined);
	}
}
