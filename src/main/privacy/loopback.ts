import { isIP } from 'node:net';

export function loopback(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
	return host === 'localhost' || host === '::1' || (isIP(host) === 4 && host.startsWith('127.'));
}
