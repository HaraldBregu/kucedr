import { getDomain } from 'tldts';
import { list } from './list';

export function tracker(host: string, resourceType: string, top: string | undefined): boolean {
	if (resourceType === 'mainFrame') return false;
	const name = host.toLowerCase().replace(/\.+$/, '');
	const page = top && URL.canParse(top) ? new URL(top) : undefined;
	if (page && /^https?:$/.test(page.protocol)) {
		const [own, other] = [page.hostname.replace(/\.+$/, ''), name].map(
			(value) => getDomain(value, { allowPrivateDomains: true }) ?? value
		);
		if (own === other) return false;
	}
	const { block, allow } = list();
	const parents = name.split('.').map((_, index, parts) => parts.slice(index).join('.'));
	return parents.some((parent) => block.has(parent)) && !parents.some((parent) => allow.has(parent));
}
