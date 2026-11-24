import http from 'node:http';
import https from 'node:https';
import WebSocket from 'ws';
import { privacyTransportInstalled } from './transport';

export function privacyWebSocket(url: string | URL, options?: WebSocket.ClientOptions): WebSocket {
	if (!privacyTransportInstalled) return new WebSocket(url, options);
	const { protocol } = new URL(url);
	const agent = protocol === 'wss:' || protocol === 'https:' ? https.globalAgent : http.globalAgent;
	return new WebSocket(url, { ...options, agent });
}
