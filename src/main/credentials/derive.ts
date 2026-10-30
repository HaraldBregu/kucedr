import { scrypt } from 'node:crypto';

/** scrypt with N=2^17, r=8 (~128 MiB, under a second) so guessing passphrases for a stolen file stays slow. */
export function derive(passphrase: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scrypt(
			passphrase.normalize('NFKC'),
			salt,
			32,
			{ N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
			(error, key) => (error ? reject(error) : resolve(key))
		)
	);
}
