import { createCipheriv, randomBytes } from 'node:crypto';
import type { CloudCredential } from '../../shared/credential_types';

export type SavedCredential = CloudCredential & { secret: string };

export interface SealedFile {
	v: 1;
	salt: string;
	iv: string;
	tag: string;
	data: string;
}

/** AES-256-GCM over the key list. The account id is authenticated, so a file only opens for its owner. */
export function seal(key: Buffer, salt: Buffer, userId: string, entries: SavedCredential[]): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	cipher.setAAD(Buffer.from(userId));
	const data = Buffer.concat([cipher.update(JSON.stringify(entries)), cipher.final()]);
	const file: SealedFile = {
		v: 1,
		salt: salt.toString('base64'),
		iv: iv.toString('base64'),
		tag: cipher.getAuthTag().toString('base64'),
		data: data.toString('base64'),
	};
	return JSON.stringify(file);
}
