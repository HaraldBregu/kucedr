import { scrypt } from 'node:crypto';
import { promisify } from 'node:util';

export function derive(passphrase, salt) {
	return promisify(scrypt)(passphrase, salt, 32, { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
}
