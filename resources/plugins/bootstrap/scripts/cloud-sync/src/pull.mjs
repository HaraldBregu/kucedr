import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe } from './describe.mjs';
import { download } from './download.mjs';
import { list } from './list.mjs';
import { isProtected } from './protected.mjs';
import { target } from './target.mjs';

export async function pull(client, { provider, roots, protectedRoot }) {
	const result = { downloaded: [], skipped: [], failed: [] };
	for (const { path: root, prefix } of roots) {
		try {
			await fs.mkdir(root, { recursive: true });
			if ((await fs.lstat(root)).isSymbolicLink()) throw new Error('Selected folder is a symbolic link.');
			const objects = (await list(client, provider.bucket, prefix)).filter((item) => !item.key.endsWith('/'));
			if (!objects.length) throw new Error(`No stored files were found in ${prefix}`);
			for (const item of objects) {
				let temporary;
				try {
					const file = await target(root, item.key, prefix);
					if (isProtected(file, protectedRoot)) throw new Error('Download targets a protected application folder.');
					await fs.mkdir(path.dirname(file), { recursive: true });
					temporary = `${file}.kucedr-${randomUUID()}.tmp`;
					await download(client, provider.bucket, item.key, temporary);
					if ((await fs.stat(temporary)).size !== item.size)
						throw new Error('Downloaded file size does not match storage.');
					await fs.rename(temporary, file);
					result.downloaded.push(item.key);
				} catch (error) {
					result.failed.push({ path: item.key, error: describe(error) });
				} finally {
					if (temporary) await fs.rm(temporary, { force: true });
				}
			}
		} catch (error) {
			result.failed.push({ path: root, error: describe(error) });
		}
	}
	return result;
}
