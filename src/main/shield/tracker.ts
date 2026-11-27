import { getDomain } from 'tldts';
import { list } from './list';

const site = (host: string): string => getDomain(host, { allowPrivateDomains: true }) ?? host;

export function tracker(host: string, resourceType: string, top: string | undefined): boolean {
	if (resourceType === 'mainFrame') return false;
	const name = host.toLowerCase().replace(/\.+$/, '');
	const page = top && URL.canParse(top) ? new URL(top) : undefined;
	if (page && /^(https?|wss?):$/.test(page.protocol) && site(page.hostname.toLowerCase()) === site(name)) return false;
	const { block, allow } = list();
	const parents = name.split('.').map((_, index, parts) => parts.slice(index).join('.'));
	return parents.some((parent) => block.has(parent)) && !parents.some((parent) => allow.has(parent));
}
