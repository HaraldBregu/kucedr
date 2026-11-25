import { getDomain } from 'tldts';

function site(href: string): string {
	const host = new URL(href).hostname;
	return getDomain(host, { allowPrivateDomains: true }) ?? host;
}

// Whether a request goes to another site than the page on screen, which makes it a third party.
export function foreign(url: string, top: string): boolean {
	if (!URL.canParse(url) || !URL.canParse(top) || !/^https?:$/.test(new URL(top).protocol)) return false;
	return site(url) !== site(top);
}
