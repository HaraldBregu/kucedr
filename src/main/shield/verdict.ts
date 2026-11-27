import type { BrowserBlocked } from '../../shared/browser';
import { dangerous } from './dangerous';
import { leaks } from './leaks';
import { local } from './local';
import { onion } from './onion';
import { tracker } from './tracker';

export interface ShieldRequest {
	readonly url: string;
	readonly method: string;
	readonly resourceType: string;
	readonly initiatorOrigin?: string;
	readonly uploadData?: readonly { readonly bytes?: Buffer }[];
}

// Why a browser request must not leave, or undefined when it may.
// Routed (Tor and proxy) tabs never reach this machine or the local network. Other tabs do when
// the user or the assistant goes there directly, but a public page cannot reach them, except by
// a plain top-level navigation.
export function verdict(
	request: ShieldRequest,
	routed: boolean,
	top: string | undefined
): BrowserBlocked['reason'] | undefined {
	if (!URL.canParse(request.url)) return undefined;
	const url = new URL(request.url);
	if (!/^(https?|wss?):$/.test(url.protocol)) return undefined;
	if (!routed && onion(url.hostname)) return 'onion';
	if (local(url.hostname)) {
		if (routed) return 'local';
		const origin = request.initiatorOrigin;
		const fromLocal = origin !== undefined && URL.canParse(origin) && local(new URL(origin).hostname);
		const navigation = request.resourceType === 'mainFrame' && request.method === 'GET';
		if (origin !== undefined && !fromLocal && !navigation) return 'local';
	}
	if (leaks(request.url) || request.uploadData?.some((part) => part.bytes && leaks(part.bytes.toString('latin1'))))
		return 'secret';
	if (tracker(url.hostname, request.resourceType, top)) return 'tracker';
	if (dangerous(url.hostname)) return 'dangerous';
	return undefined;
}
