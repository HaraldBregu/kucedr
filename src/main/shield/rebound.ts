import { isIP } from 'node:net';
import type { Session } from 'electron';
import { privateAddress } from '../private';
import { local } from './local';
import type { ShieldRequest } from './verdict';

// Whether each page or frame origin was loaded from a private address, as last seen.
// ponytail: grows with the origins a session visits; fine for a browsing session.
const loadedPrivate = new Map<string, boolean>();

// DNS rebinding: a public name that now resolves to a private address. Blocked when a page that
// was loaded from a public address sends it, except a plain top-level navigation. Uses the
// session's own resolver, so the answer is the one its connection gets from the shared cache.
// Direct and private tabs only: on Tor and proxy tabs a local lookup would reveal the name.
// ponytail: a resolver answer that flips between this lookup and the connection passes.
export async function rebound(browsing: Session, request: ShieldRequest): Promise<boolean> {
	const url = new URL(request.url);
	if (!/^(https?|wss?):$/.test(url.protocol)) return false;
	const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
	if (isIP(host) || local(host)) return false;
	const resolved = await browsing.resolveHost(host).catch(() => undefined);
	const toPrivate = resolved?.endpoints.some((endpoint) => privateAddress(endpoint.address)) ?? false;
	const origin = request.initiatorOrigin;
	const navigation = request.resourceType === 'mainFrame' && request.method === 'GET';
	const fromPublic =
		origin !== undefined &&
		!(URL.canParse(origin) && (local(new URL(origin).hostname) || loadedPrivate.get(new URL(origin).origin)));
	const blocked = toPrivate && fromPublic && !navigation;
	if (!blocked && (request.resourceType === 'mainFrame' || request.resourceType === 'subFrame'))
		loadedPrivate.set(url.origin, toPrivate);
	return blocked;
}
