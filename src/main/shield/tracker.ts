import { getDomain } from 'tldts';
import { list } from './list';

const KIND: Record<string, string> = {
	subFrame: 'subdocument',
	document: 'subdocument',
	script: 'script',
	image: 'image',
	stylesheet: 'stylesheet',
	object: 'object',
	xhr: 'xmlhttprequest',
	fetch: 'xmlhttprequest',
	ping: 'ping',
	webSocket: 'websocket',
	websocket: 'websocket',
	font: 'font',
	media: 'media',
	popup: 'popup',
};

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
	const kind = KIND[resourceType] ?? 'other';
	const parents = name.split('.').map((_, index, parts) => parts.slice(index).join('.'));
	return (
		parents.some((parent) => block.get(parent)?.has(kind)) && !parents.some((parent) => allow.get(parent)?.has(kind))
	);
}
