import { createCipheriv, randomBytes } from 'node:crypto';
import { vaultKey } from './key';
import { MAGIC } from './magic';
import { isVaultEnabled } from './state';

export function seal(content: string | Uint8Array): Buffer {
	const plain = Buffer.from(content);
	if (!isVaultEnabled()) return plain;
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', vaultKey(), iv);
	const data = Buffer.concat([cipher.update(plain), cipher.final()]);
	return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), data]);
}
