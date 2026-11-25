import { app, session } from 'electron';
import type { BrowserRoute } from '../../../../../shared/browser';
import { connections } from '../../../../browser/connections';
import { findTor } from '../../../../browser/tor';
import { getPrivacyRoute, isPrivacyEnabled } from '../../../../privacy/state';
import { askPermission } from './ask';
import { guard } from './guard';
import { holdDownload } from './hold';
import { sitePermits } from './pane';
import { uses } from './uses';

const prepared = new Map<string, Promise<void>>();

async function proxyRules(route: BrowserRoute): Promise<string> {
	if (isPrivacyEnabled()) {
		if (route === 'tor') throw new Error('Tor tabs are unavailable while Privacy Mode is on.');
		const proxy = getPrivacyRoute();
		if (!proxy) throw new Error('Privacy Mode is blocking online access.');
		return proxy;
	}
	if (route === 'tor') {
		const address = await findTor();
		if (!address)
			throw new Error('Tor is not running. Start Tor Browser or the Tor service, or set its address in Settings → Browser.');
		// socks5 hands host names to Tor, so no name is looked up on this connection.
		return `socks5://${address}`;
	}
	const proxy = connections().proxy;
	if (!proxy) throw new Error('No proxy is set. Add one in Settings → Browser.');
	return proxy;
}

// Sets up a tab session once: user agent, site permissions, downloads, the shield, and for Tor
// and proxy tabs the connection. Resolves when the session may send requests.
export function prepare(partition: string, route: BrowserRoute): Promise<void> {
	const existing = prepared.get(partition);
	if (existing) return existing;
	const browsing = session.fromPartition(partition);
	browsing.setUserAgent(
		browsing
			.getUserAgent()
			.split(' ')
			.filter((part) => !/^electron\//i.test(part) && !part.startsWith(`${app.getName()}/`))
			.join(' ')
	);
	browsing.setPermissionRequestHandler(askPermission(partition, route));
	browsing.setPermissionCheckHandler((_contents, permission, origin, details) => {
		const kinds = uses(permission, details.mediaType ? [details.mediaType] : undefined);
		const site = URL.canParse(origin) ? new URL(origin).origin : '';
		return kinds.length > 0 && kinds.every((kind) => sitePermits.get(`${partition} ${site} ${kind}`) === true);
	});
	browsing.on('will-download', (event, item, contents) => holdDownload(event, item, contents, route));
	const routed = isPrivacyEnabled() || route === 'tor' || route === 'proxy';
	let open = !routed;
	guard(browsing, routed, () => open);
	const ready = routed
		? proxyRules(route).then(async (proxyRules) => {
				// Fixed servers never fall back to a direct connection; '<-loopback>' sends this
				// machine's addresses through the proxy too instead of around it.
				await browsing.setProxy({ mode: 'fixed_servers', proxyRules, proxyBypassRules: '<-loopback>' });
				open = true;
			})
		: Promise.resolve();
	ready.catch(() => undefined);
	prepared.set(partition, ready);
	return ready;
}
