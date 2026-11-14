import { lookup } from 'node:dns/promises';
import { privateAddress } from './private';

export interface PublicUrl {
	url: URL;
	address: string;
	family: 4 | 6;
}

export async function publicUrl(value: string): Promise<PublicUrl> {
	const url = new URL(value);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported URL.');
	if (url.username || url.password) throw new Error('URL credentials are not allowed.');
	const hostname = url.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
	if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
		throw new Error('Private URLs are not allowed.');
	}
	const addresses = await lookup(hostname, { all: true, verbatim: true });
	if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) {
		throw new Error('Private URLs are not allowed.');
	}
	return {
		url,
		address: addresses[0].address,
		family: addresses[0].family === 6 ? 6 : 4,
	};
}
