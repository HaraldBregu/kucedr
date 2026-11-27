import { isIP } from 'node:net';
import { privateAddress } from '../private';

// A host on this machine or the local network, judged from the name alone: no address lookup,
// so it can run on Tor and proxy tabs without revealing the name.
// A public name that resolves to a private address is caught on direct tabs by `rebound`.
export function local(hostname: string): boolean {
	const host = hostname
		.toLowerCase()
		.replace(/^\[(.*)\]$/, '$1')
		.replace(/\.+$/, '');
	// URL parsing writes IPv4-mapped IPv6 in hex (::ffff:7f00:1); judge the embedded IPv4.
	const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
	if (mapped) {
		const high = parseInt(mapped[1], 16);
		const low = parseInt(mapped[2], 16);
		return privateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
	}
	if (isIP(host)) return privateAddress(host);
	return (
		host === 'localhost' ||
		host.endsWith('.localhost') ||
		host.endsWith('.local') ||
		host.endsWith('.home.arpa') ||
		!host.includes('.')
	);
}
