import { isIP } from 'node:net';

export function loopback(hostname: string): boolean {
	const bare = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
	if (bare === 'localhost') return true;
	let host: string;
	try {
		host = new URL(`http://${bare.includes(':') ? `[${bare}]` : bare}`).hostname.replace(/^\[(.*)\]$/, '$1');
	} catch {
		return false;
	}
	if (host === '::1') return true;
	if (isIP(host) === 4) return host.startsWith('127.');
	return /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(host);
}
