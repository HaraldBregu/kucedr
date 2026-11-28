import { createDecipheriv } from 'node:crypto';
import { vaultKey } from './key';
import { MAGIC } from './magic';

export function unseal(raw: Buffer): Buffer {
	if (!raw.subarray(0, MAGIC.length).equals(MAGIC)) return raw;
	const iv = MAGIC.length;
	const tag = iv + 12;
	const data = tag + 16;
	try {
		const decipher = createDecipheriv('aes-256-gcm', vaultKey(), raw.subarray(iv, tag));
		decipher.setAuthTag(raw.subarray(tag, data));
		return Buffer.concat([decipher.update(raw.subarray(data)), decipher.final()]);
	} catch {
		throw new VaultError();
	}
}
