import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { decrypt } from './decrypt.mjs';
import { describe } from './describe.mjs';
import { download } from './download.mjs';
import { head } from './head.mjs';
import { list } from './list.mjs';
import { BACKUP } from './magic.mjs';
import { isProtected } from './protected.mjs';
import { target } from './target.mjs';

export async function pull(client, { provider, roots, protectedRoot }) {
	const result = { downloaded: [], skipped: [], failed: [] };
	const keys = new Map();
	for (const { path: root, prefix } of roots) {
		try {
			await fs.mkdir(root, { recursive: true });
			if ((await fs.lstat(root)).isSymbolicLink()) throw new Error('Selected folder is a symbolic link.');
			const objects = (await list(client, provider.bucket, prefix)).filter((item) => !item.key.endsWith('/'));
			if (!objects.length) throw new Error(`No stored files were found in ${prefix}`);
			for (const item of objects) {
				let temporary;
				let plain;
				try {
					const file = await target(root, item.key, prefix);
					if (isProtected(file, protectedRoot)) throw new Error('Download targets a protected application folder.');
					await fs.mkdir(path.dirname(file), { recursive: true });
					temporary = `${file}.kucedr-${randomUUID()}.tmp`;
					await download(client, provider.bucket, item.key, temporary);
					if ((await fs.stat(temporary)).size !== item.size)
						throw new Error('Downloaded file size does not match storage.');
					if ((await head(temporary, BACKUP.length)).equals(BACKUP)) {
						if (!provider.passphrase)
							throw Object.assign(
								new Error(
									'This backup is encrypted. Add the backup passphrase in the storage settings to restore it.'
								),
								{ fatal: true }
							);
						plain = `${file}.kucedr-${randomUUID()}.tmp`;
						await decrypt(temporary, plain, item.key, provider.passphrase, keys);
					}
					await fs.rename(plain ?? temporary, file);
					result.downloaded.push(item.key);
				} catch (error) {
					if (error.fatal) throw error;
					result.failed.push({ path: item.key, error: describe(error) });
				} finally {
					if (temporary) await fs.rm(temporary, { force: true });
					if (plain) await fs.rm(plain, { force: true });
				}
			}
		} catch (error) {
			if (error.fatal) throw error;
			result.failed.push({ path: root, error: describe(error) });
		}
	}
	return result;
}
