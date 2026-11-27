export const HOST_PORT = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+):\d{1,5}$/i;

export function acceptedProxy(value: string): boolean {
	const scheme = /^(socks5|http|https):\/\/(.+)$/i.exec(value);
	return Boolean(scheme && HOST_PORT.test(scheme[2]));
}
