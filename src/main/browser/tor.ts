import { connect } from 'node:net';
import { connections } from './connections';

// Tor Browser listens on 9150, the Tor service on 9050.
const CANDIDATES = ['127.0.0.1:9150', '127.0.0.1:9050'];
const PROBE_MS = 1_500;

function answers(address: string): Promise<boolean> {
	const at = address.lastIndexOf(':');
	const host = address.slice(0, at).replace(/^\[(.*)\]$/, '$1');
	const port = Number(address.slice(at + 1));
	return new Promise((resolve) => {
		const socket = connect({ host, port });
		const done = (ok: boolean): void => {
			socket.destroy();
			resolve(ok);
		};
		socket.setTimeout(PROBE_MS, () => done(false));
		socket.once('error', () => done(false));
		// A SOCKS5 greeting offering no authentication; a SOCKS5 server answers 05 00.
		socket.once('connect', () => socket.write(Buffer.from([5, 1, 0])));
		socket.once('data', (data) => done(data[0] === 5 && data[1] === 0));
	});
}

export async function findTor(): Promise<string | undefined> {
	const configured = connections().tor;
	for (const address of configured ? [configured] : CANDIDATES) if (await answers(address)) return address;
	return undefined;
}
