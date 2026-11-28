import { getDomain } from 'tldts';

// An unknown or non-web top page counts as third-party.
export function thirdParty(host: string, top: string | undefined): boolean {
	const page = top && URL.canParse(top) ? new URL(top) : undefined;
	if (!page || !/^https?:$/.test(page.protocol)) return true;
	const [own, other] = [page.hostname, host.toLowerCase()].map((value) => {
		const name = value.replace(/\.+$/, '');
		return getDomain(name, { allowPrivateDomains: true }) ?? name;
	});
	return own !== other;
}
