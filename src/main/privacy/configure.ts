import { app, session } from 'electron';
import { connect } from 'node:net';
import { getPrivacyRoute, isPrivacyEnabled, setPrivacyStatus } from './state';
import { APP_SESSION_PARTITION } from '../protocol';

export async function configurePrivacy(): Promise<void> {
	if (!isPrivacyEnabled()) return;

	const route = getPrivacyRoute();
	const config = {
		mode: 'fixed_servers' as const,
		proxyRules: route ?? 'socks5://127.0.0.1:1',
		proxyBypassRules: '<-loopback>',
	};
	const sessions = [session.defaultSession, session.fromPartition(APP_SESSION_PARTITION)];
	let ready = false;
	for (const target of sessions) {
		target.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
			(_details, callback) => callback({ cancel: !ready }));
	}
	try {
		await Promise.all([app.setProxy(config), ...sessions.map((target) => target.setProxy(config))]);
		ready = Boolean(route);
	} catch {
		setPrivacyStatus('blocked');
		return;
	}
	if (!route) {
		setPrivacyStatus('blocked');
		return;
	}

	const port = Number(new URL(route).port);
	const probe = (): void => {
		const socket = connect({ host: '127.0.0.1', port });
		let reply = Buffer.alloc(0);
		let answered = false;
		const finish = (ok: boolean): void => {
			if (answered) return;
			answered = true;
			socket.destroy();
			setPrivacyStatus(ok ? 'protected' : 'blocked');
		};
		socket.setTimeout(1500, () => finish(false));
		socket.once('error', () => finish(false));
		socket.once('close', () => finish(false));
		socket.once('connect', () => socket.write(Buffer.from([5, 1, 0])));
		socket.on('data', (data) => {
			reply = Buffer.concat([reply, Buffer.from(data)]);
			if (reply.length >= 2) finish(reply[0] === 5 && reply[1] === 0);
		});
	};
	probe();
	const timer = setInterval(probe, 3000);
	timer.unref();
	app.once('will-quit', () => clearInterval(timer));
}
