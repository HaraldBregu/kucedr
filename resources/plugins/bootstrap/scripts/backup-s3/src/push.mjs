import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe } from './describe.mjs';
import { list } from './list.mjs';
import { remove } from './remove.mjs';
import { upload } from './upload.mjs';
import { walk } from './walk.mjs';

export async function push(client, { provider, roots, protectedRoot }) {
	const uploaded = [];
	const deleted = [];
	const failed = [];
	for (const { path: root, prefix } of roots) {
		try {
			const stat = await fs.lstat(root);
			if (stat.isSymbolicLink()) throw new Error(`Selected path is a symbolic link: ${root}`);
			const sources = stat.isDirectory() ? await walk(root, protectedRoot) : [root];
			const keys = new Set();
			let complete = true;
			for (const source of sources) {
				try {
					const key = stat.isDirectory()
						? `${prefix}${path.relative(root, source).split(path.sep).join('/')}`
						: path.basename(root);
					await upload(client, provider.bucket, source, key);
					keys.add(key);
					uploaded.push(source);
				} catch (error) {
					complete = false;
					failed.push({ path: source, error: describe(error) });
				}
			}
			if (!stat.isDirectory() || !complete) continue;
			const stale = (await list(client, provider.bucket, prefix))
				.map((item) => item.key)
				.filter((key) => !keys.has(key));
			await remove(client, provider.bucket, stale);
			deleted.push(...stale);
		} catch (error) {
			failed.push({ path: root, error: describe(error) });
		}
	}
	return { uploaded, deleted, failed };
}
