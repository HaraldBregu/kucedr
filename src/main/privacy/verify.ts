import { connect, createServer } from 'node:net';

export function verifySandbox(): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer((socket) => socket.destroy());
		server.once('error', () => resolve(false));
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close(() => resolve(false));
				return;
			}

			const socket = connect({ host: '127.0.0.1', port: address.port });
			const finish = (blocked: boolean): void => {
				socket.destroy();
				server.close(() => resolve(blocked));
			};
			socket.once('connect', () => finish(false));
			socket.once('error', (error: NodeJS.ErrnoException) => finish(error.code === 'EPERM' || error.code === 'EACCES'));
			socket.setTimeout(1500, () => finish(false));
		});
	});
}
