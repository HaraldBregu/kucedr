import { lookup } from 'node:dns/promises';
import type { NetworkHostPattern } from '@anthropic-ai/sandbox-runtime';
import { privateAddress } from '../../private';
import { local } from '../../shield/local';

export async function egress({ host }: NetworkHostPattern): Promise<boolean> {
	const name = host.toLowerCase().replace(/^\[(.*)\]$/, '$1');
	if (local(name)) return false;
	const addresses = await lookup(name, { all: true, verbatim: true }).catch(() => []);
	return addresses.length > 0 && !addresses.some(({ address }) => privateAddress(address));
}
