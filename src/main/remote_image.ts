import { local } from './shield/local';

const MAX_BYTES = 10 * 1024 * 1024;

// Loads an image the user chose to show, so the app window never contacts remote hosts itself.
// Every redirect hop is checked, and nothing on this machine or the local network is fetched.
export async function remoteImage(address: string): Promise<string> {
	let url = new URL(address);
	for (let hop = 0; hop < 5; hop++) {
		if (!/^https?:$/.test(url.protocol) || local(url.hostname)) throw new Error('This image address is not allowed.');
		const response = await fetch(url, {
			redirect: 'manual',
			credentials: 'omit',
			referrerPolicy: 'no-referrer',
			signal: AbortSignal.timeout(15_000),
		});
		const next = response.headers.get('location');
		if (response.status >= 300 && response.status < 400 && next) {
			url = new URL(next, url);
			continue;
		}
		const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
		if (!response.ok || !type.startsWith('image/')) throw new Error('The address did not return an image.');
		if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('The image is too large.');
		const data = Buffer.from(await response.arrayBuffer());
		if (data.length > MAX_BYTES) throw new Error('The image is too large.');
		return `data:${type};base64,${data.toString('base64')}`;
	}
	throw new Error('The image address redirects too many times.');
}
