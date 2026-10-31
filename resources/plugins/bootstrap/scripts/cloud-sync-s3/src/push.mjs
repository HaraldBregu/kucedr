import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe } from './describe.mjs';
import { upload } from './upload.mjs';
import { walk } from './walk.mjs';

export async function push(client, { provider, roots, protectedRoot }) {
	const uploaded = [];
	const failed = [];
	for (const { path: root, prefix } of roots) {
		try {
			const stat = await fs.lstat(root);
			if (stat.isSymbolicLink()) throw new Error(`Selected path is a symbolic link: ${root}`);
			const sources = stat.isDirectory() ? await walk(root, protectedRoot) : [root];
			for (const source of sources) {
				try {
					const key = stat.isDirectory()
						? `${prefix}${path.relative(root, source).split(path.sep).join('/')}`
						: path.basename(root);
					await upload(client, provider.bucket, source, key);
					uploaded.push(source);
				} catch (error) {
					failed.push({ path: source, error: describe(error) });
				}
			}
		} catch (error) {
			failed.push({ path: root, error: describe(error) });
		}
	}
	return { uploaded, failed };
}
