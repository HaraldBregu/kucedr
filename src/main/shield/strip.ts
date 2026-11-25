// Campaign tags (utm_*) and click ids (…clid, …clkid): they name the visit, not the page.
const TRACKING = /^(utm_[a-z0-9_]+|[a-z]+clk?id)$/i;

// The address without tracking parameters, or undefined when it has none. The rest of the query
// and the fragment keep their exact bytes.
export function strip(address: string): string | undefined {
	const hash = address.indexOf('#');
	const end = hash === -1 ? address.length : hash;
	const start = address.indexOf('?');
	if (start === -1 || start > end) return undefined;
	const parts = address.slice(start + 1, end).split('&');
	const kept = parts.filter((part) => !TRACKING.test(part.split('=', 1)[0]));
	if (kept.length === parts.length) return undefined;
	return address.slice(0, start) + (kept.length ? `?${kept.join('&')}` : '') + address.slice(end);
}
