import { app } from 'electron';
import { ONION_RULES } from '../shield/onion';
import { getPrivacyRoute, isPrivacyEnabled } from './state';

export function setStartupProxy(): void {
	if (!isPrivacyEnabled()) {
		const rules = app.commandLine.getSwitchValue('host-resolver-rules');
		app.commandLine.appendSwitch('host-resolver-rules', rules ? `${ONION_RULES}, ${rules}` : ONION_RULES);
		return;
	}

	app.commandLine.appendSwitch('disable-background-networking');
	app.commandLine.appendSwitch('disable-quic');
	app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND, EXCLUDE 127.0.0.1');
	app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
	for (const flag of ['no-proxy-server', 'proxy-pac-url', 'proxy-auto-detect']) app.commandLine.removeSwitch(flag);
	app.commandLine.appendSwitch('proxy-server', getPrivacyRoute() ?? 'socks5://127.0.0.1:1');
	app.commandLine.appendSwitch('proxy-bypass-list', '<-loopback>');
}
