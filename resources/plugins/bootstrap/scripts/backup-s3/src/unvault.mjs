import { createDecipheriv } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { head } from './head.mjs';
import { LINE, VAULT } from './magic.mjs';

function open(raw, key) {
	const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(8, 20));
	decipher.setAuthTag(raw.subarray(20, 36));
	return Buffer.concat([decipher.update(raw.subarray(36)), decipher.final()]);
}

// Files sealed whole, and append-only files sealed line by line, are opened with the vault key.
export async function unvault(source, vaultKey) {
	if (!vaultKey) return createReadStream(source);
	const start = await head(source, VAULT.length);
	const key = Buffer.from(vaultKey, 'base64');
	if (start.equals(VAULT)) return Readable.from([open(await fs.readFile(source), key)]);
	if (!start.subarray(0, LINE.length).equals(LINE)) return createReadStream(source);
	const lines = (await fs.readFile(source, 'utf8'))
		.split('\n')
		.map((line) =>
			line.startsWith('v1:') ? open(Buffer.from(line.slice(3), 'base64'), key).toString('utf8') : line
		);
	return Readable.from([Buffer.from(lines.join('\n'))]);
}
