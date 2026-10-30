import { createDecipheriv } from 'node:crypto';
import type { SavedCredential, SealedFile } from './seal';

export function open(key: Buffer, userId: string, file: SealedFile): SavedCredential[] {
	try {
		const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(file.iv, 'base64'));
		decipher.setAAD(Buffer.from(userId));
		decipher.setAuthTag(Buffer.from(file.tag, 'base64'));
		const data = Buffer.concat([decipher.update(Buffer.from(file.data, 'base64')), decipher.final()]);
		return JSON.parse(data.toString('utf8')) as SavedCredential[];
	} catch {
		throw new Error('The passphrase is incorrect.');
	}
}
