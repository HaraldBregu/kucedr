import { isIP } from 'node:net';
import { resolveMcpEndpoint } from './endpoint';

export function parseMcpUrl(value: string): URL {
	const url = new URL(resolveMcpEndpoint(value, true));
	if (url.protocol === 'https:') return url;
	const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
	const loopback =
		hostname === 'localhost' ||
		hostname === '::1' ||
		(isIP(hostname) === 4 && hostname.startsWith('127.'));
	if (url.protocol === 'http:' && loopback) return url;
	throw new Error('Remote MCP servers must use HTTPS; HTTP is allowed only for loopback hosts.');
}
