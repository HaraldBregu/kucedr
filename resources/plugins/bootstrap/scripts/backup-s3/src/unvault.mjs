import { createDecipheriv } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { head } from './head.mjs';
import { VAULT } from './magic.mjs';

export async function unvault(source, vaultKey) {
	if (!vaultKey || !(await head(source, VAULT.length)).equals(VAULT)) return createReadStream(source);
	const raw = await fs.readFile(source);
	const decipher = createDecipheriv('aes-256-gcm', Buffer.from(vaultKey, 'base64'), raw.subarray(8, 20));
	decipher.setAuthTag(raw.subarray(20, 36));
	return Readable.from([Buffer.concat([decipher.update(raw.subarray(36)), decipher.final()])]);
}
