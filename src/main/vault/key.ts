import { safeStorage } from 'electron';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { sealedVaultKey } from './state';

let cached: Buffer | undefined;

export function vaultKey(): Buffer {
	if (cached) return cached;
	const sealed = sealedVaultKey();
	let key: Buffer | undefined;
	try {
		if (sealed && isSafeStorageAvailable())
			key = Buffer.from(safeStorage.decryptString(Buffer.from(sealed, 'base64')), 'base64');
	} catch {
		key = undefined;
	}
	if (key?.length !== 32)
		throw new Error('Encrypted data could not be opened with the system keystore.');
	cached = key;
	return key;
}
