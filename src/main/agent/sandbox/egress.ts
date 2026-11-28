import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { NetworkHostPattern } from '@anthropic-ai/sandbox-runtime';
import { privateAddress } from '../../private';
import { local } from '../../shield/local';

export async function egress({ host }: NetworkHostPattern): Promise<boolean> {
	const bare = host.replace(/^\[(.*)\]$/, '$1');
	const name = new URL(`http://${isIP(bare) === 6 ? `[${bare}]` : bare}/`).hostname.replace(/^\[(.*)\]$/, '$1');
	if (local(name)) return false;
	// ponytail: approvals are pooled across running commands; the runtime does not say which command dialled.
	if (!listed(name) && ![...opened.values()].some((hosts) => covers(hosts, siteHost(name)))) {
		refused.add(siteHost(name));
		return false;
	}
	const addresses = await lookup(name, { all: true, verbatim: true }).catch(() => []);
	return addresses.length > 0 && !addresses.some(({ address }) => privateAddress(address));
}
