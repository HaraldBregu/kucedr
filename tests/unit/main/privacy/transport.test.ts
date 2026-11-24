import { once } from 'node:events';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { fetch, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { WebSocketServer } from 'ws';
import { installPrivacyTransport } from '../../../../src/main/privacy/transport';
import { privacyWebSocket } from '../../../../src/main/privacy/websocket';

const originalHttpAgent = http.globalAgent;
const originalHttpsAgent = https.globalAgent;
const originalDispatcher = getGlobalDispatcher();

afterEach(async () => {
	http.globalAgent.destroy();
	https.globalAgent.destroy();
	await getGlobalDispatcher().destroy();
	http.globalAgent = originalHttpAgent;
	https.globalAgent = originalHttpsAgent;
	setGlobalDispatcher(originalDispatcher);
	syncBuiltinESMExports();
});

test('routes Fetch redirects, native HTTP and WebSocket destination names through SOCKS5', async () => {
	const destinations: string[] = [];
	const connections = new Set<Socket>();
	const origin = http.createServer((request, response) => {
		if (request.url === '/redirect') {
			response.writeHead(302, { Location: 'http://second.invalid/stream' }).end();
			return;
		}
		response.writeHead(200);
		response.write(request.headers.host);
		response.end(' received');
	});
	const webSockets = new WebSocketServer({ server: origin });
	webSockets.on('connection', (socket) => socket.send('proxied'));
	const proxy = createServer((socket) => {
		connections.add(socket);
		socket.once('close', () => connections.delete(socket));
		socket.once('data', () => {
			socket.once('data', (connect) => {
				if (connect[3] !== 3) {
					socket.destroy();
					return;
				}
				destinations.push(connect.subarray(5, 5 + connect[4]).toString());
				socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0]));
				origin.emit('connection', socket);
			});
			socket.write(Buffer.from([5, 0]));
		});
	});
	try {
		const listening = once(proxy, 'listening');
		proxy.listen(0, '127.0.0.1');
		await listening;
		installPrivacyTransport(`socks5://127.0.0.1:${(proxy.address() as AddressInfo).port}`);

		const response = await fetch('http://first.invalid/redirect');
		expect(response.url).toBe('http://second.invalid/stream');
		await expect(response.text()).resolves.toBe('second.invalid received');

		const native = http.get('http://native.invalid/');
		const [nativeResponse] = await once(native, 'response');
		const chunks: Buffer[] = [];
		for await (const chunk of nativeResponse) chunks.push(chunk);
		expect(Buffer.concat(chunks).toString()).toBe('native.invalid received');

		const socket = privacyWebSocket('ws://voice.invalid/');
		try {
			const [message] = await once(socket, 'message');
			expect(message.toString()).toBe('proxied');
		} finally {
			socket.terminate();
		}
		expect(destinations).toEqual(['first.invalid', 'second.invalid', 'native.invalid', 'voice.invalid']);

		proxy.close();
		await expect(fetch('http://after-drop.invalid/')).rejects.toMatchObject({
			cause: expect.objectContaining({ code: 'ECONNREFUSED' }),
		});
	} finally {
		for (const socket of connections) socket.destroy();
		proxy.close();
		webSockets.close();
	}
});

test('blocks Fetch, native HTTPS, and WebSocket when no route is available', async () => {
	installPrivacyTransport(undefined);
	await expect(fetch('https://blocked.invalid/')).rejects.toMatchObject({
		cause: expect.objectContaining({ message: 'The network is blocked by Privacy Mode.' }),
	});
	const native = https.get('https://blocked.invalid/');
	await expect(once(native, 'response')).rejects.toThrow('The network is blocked by Privacy Mode.');
	const socket = privacyWebSocket('wss://blocked.invalid/');
	await expect(once(socket, 'open')).rejects.toThrow('The network is blocked by Privacy Mode.');
});
