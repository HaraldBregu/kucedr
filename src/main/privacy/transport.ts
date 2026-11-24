import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Agent, setGlobalDispatcher, Socks5ProxyAgent } from 'undici';

const BLOCKED = 'The network is blocked by Privacy Mode.';

export function installPrivacyTransport(proxy: string | undefined): void {
	if (proxy) {
		// The native HTTP agent uses the explicit remote-DNS SOCKS5 scheme.
		const remoteDnsProxy = `socks5h://${new URL(proxy).host}`;
		http.globalAgent = new SocksProxyAgent(remoteDnsProxy);
		Object.assign(https, { globalAgent: new SocksProxyAgent(remoteDnsProxy) });
		setGlobalDispatcher(new Socks5ProxyAgent(proxy));
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
}
