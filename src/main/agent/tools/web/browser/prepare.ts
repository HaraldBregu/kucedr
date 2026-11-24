import { app, session } from 'electron';
import type { BrowserRoute } from '../../../../../shared/browser';
import { connections } from '../../../../browser/connections';
import { findTor } from '../../../../browser/tor';
import { guard } from './guard';
import { holdDownload } from './hold';

const prepared = new Map<string, Promise<void>>();

async function proxyRules(route: BrowserRoute): Promise<string> {
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
	browsing.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
	browsing.setPermissionCheckHandler(() => false);
	browsing.on('will-download', (event, item, contents) => holdDownload(event, item, contents, route));
	const routed = route === 'tor' || route === 'proxy';
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
