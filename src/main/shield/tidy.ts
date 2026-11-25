import { local } from './local';

// Click-tracking parameters that name the visitor, not the page (Brave's default list).
// ponytail: fixed list, campaign tags (utm_*) kept; load a maintained list if sites add new ones.
const TRACKING = new Set([
	'__hsfp',
	'__hssc',
	'__hstc',
	'__s',
	'_hsenc',
	'_openstat',
	'dclid',
	'fbclid',
	'gbraid',
	'gclid',
	'hsCtaTracking',
	'igshid',
	'mc_eid',
	'mkt_tok',
	'ml_subscriber',
	'ml_subscriber_hash',
	'msclkid',
	'oly_anon_id',
	'oly_enc_id',
	'rb_clickid',
	's_cid',
	'ttclid',
	'twclid',
	'vero_conv',
	'vero_id',
	'wbraid',
	'wickedid',
	'yclid',
]);

// The address a top-level page load goes to instead: without click-tracking parameters, and over
// HTTPS when it is a public http address on the default port that has not failed over HTTPS
// (`plain`). Returns `href` unchanged when nothing applies.
export function tidy(href: string, plain: ReadonlySet<string>): string {
	if (!URL.canParse(href)) return href;
	const url = new URL(href);
	if (!/^https?:$/.test(url.protocol)) return href;
	const parts = url.search.slice(1).split('&');
	const kept = parts.filter((part) => !TRACKING.has(part.split('=', 1)[0]));
	if (kept.length !== parts.length) url.search = kept.join('&');
	if (
		url.protocol === 'http:' &&
		!url.port &&
		!local(url.hostname) &&
		!url.hostname.endsWith('.onion') &&
		!plain.has(url.hostname)
	)
		url.protocol = 'https:';
	return url.href === new URL(href).href ? href : url.href;
}
