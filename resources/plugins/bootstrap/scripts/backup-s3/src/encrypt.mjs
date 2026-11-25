import { createCipheriv, randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { BACKUP } from './magic.mjs';

export async function encrypt(input, file, key, salt, aad) {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	cipher.setAAD(Buffer.from(aad, 'utf8'));
	await pipeline(
		input,
		async function* (chunks) {
			yield Buffer.concat([BACKUP, salt, iv]);
			for await (const chunk of chunks) yield cipher.update(chunk);
			yield cipher.final();
			yield cipher.getAuthTag();
		},
		createWriteStream(file, { flags: 'wx', mode: 0o600 })
	);
}
