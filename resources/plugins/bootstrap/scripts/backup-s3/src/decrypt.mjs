import { createDecipheriv } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { derive } from './derive.mjs';
import { BACKUP } from './magic.mjs';

const HEADER = BACKUP.length + 16 + 12;

export async function decrypt(source, file, aad, passphrase, keys) {
	const header = Buffer.alloc(HEADER);
	const tag = Buffer.alloc(16);
	const handle = await fs.open(source, 'r');
	let size;
	try {
		({ size } = await handle.stat());
		await handle.read(header, 0, HEADER, 0);
		await handle.read(tag, 0, 16, Math.max(0, size - 16));
	} finally {
		await handle.close();
	}
	const salt = header.subarray(BACKUP.length, BACKUP.length + 16);
	const id = salt.toString('hex');
	if (!keys.has(id)) keys.set(id, derive(passphrase, salt));
	const decipher = createDecipheriv('aes-256-gcm', await keys.get(id), header.subarray(BACKUP.length + 16));
	decipher.setAAD(Buffer.from(aad, 'utf8'));
	decipher.setAuthTag(tag);
	await pipeline(
		size > HEADER + 16 ? createReadStream(source, { start: HEADER, end: size - 17 }) : [],
		async function* (chunks) {
			for await (const chunk of chunks) yield decipher.update(chunk);
			let rest;
			try {
				if (size < HEADER + 16) throw new Error('The backup file is too short.');
				rest = decipher.final();
			} catch {
				throw Object.assign(new Error('The backup passphrase is wrong, or the backup was changed.'), {
					fatal: true,
				});
			}
			yield rest;
		},
		createWriteStream(file, { flags: 'wx', mode: 0o600 })
	);
}
