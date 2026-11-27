import { hosts } from './hosts';

export function dangerous(hostname: string): boolean {
	const host = hostname
		.toLowerCase()
		.replace(/^\[(.*)\]$/, '$1')
		.replace(/\.+$/, '');
	const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
	if (!mapped) return hosts().has(host);
	const high = parseInt(mapped[1], 16);
	const low = parseInt(mapped[2], 16);
	return hosts().has(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
}
