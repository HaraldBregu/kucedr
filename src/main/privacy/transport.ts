import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Agent, setGlobalDispatcher, Socks5ProxyAgent } from 'undici';

const BLOCKED = 'The network is blocked by Privacy Mode.';

export let privacyTransportInstalled = false;

export function installPrivacyTransport(proxy: string | undefined): void {
	if (proxy) {
		const remoteDnsProxy = `socks5h://${new URL(proxy).host}`;
		for (const [module, local] of [
			[http, new http.Agent()],
			[https, new https.Agent()],
		] as const) {
			const agent = new SocksProxyAgent(remoteDnsProxy);
			const connect = agent.connect.bind(agent);
			Object.assign(agent, {
				connect: (...[request, options]: Parameters<typeof connect>) =>
					loopback(options.host ?? '') ? local : connect(request, options),
			});
			Object.assign(module, { globalAgent: agent });
		}
		const direct = new Agent();
		setGlobalDispatcher(
			new Socks5ProxyAgent(proxy).compose(
				(dispatch) => (options, handler) =>
					loopback(new URL(String(options.origin)).hostname)
						? direct.dispatch(options, handler)
						: dispatch(options, handler)
			)
		);
	} else {
		http.globalAgent = new http.Agent();
		https.globalAgent = new https.Agent();
		for (const agent of [http.globalAgent, https.globalAgent]) {
			agent.createConnection = (_options, callback) => {
				if (!callback) throw new Error(BLOCKED);
				callback(new Error(BLOCKED), undefined!);
				return undefined;
			};
		}
		setGlobalDispatcher(new Agent({ connect: (_options, callback) => callback(new Error(BLOCKED), null) }));
	}
	syncBuiltinESMExports();
	privacyTransportInstalled = true;
}
