import type { Session } from 'electron';

const MAX_BYTES = 200_000;
const IMAGE_TYPE = /^image\/[a-z0-9.+-]+$/i;

export async function favicon(browsing: Session, icon: string): Promise<string | undefined> {
	if (/^data:/i.test(icon)) {
		if (Buffer.byteLength(icon) <= (MAX_BYTES * 4) / 3 && /^data:image\/[a-z0-9.+-]+[;,]/i.test(icon)) return icon;
		return undefined;
	}
	const response = await browsing.fetch(icon, { signal: AbortSignal.timeout(5_000) });
	const body = response.body;
	if (!body) return undefined;
	const contentType = response.headers.get('content-type')?.split(';')[0].trim();
	const type = !contentType || contentType === 'application/octet-stream' ? 'image/x-icon' : contentType;
	if (!response.ok || !IMAGE_TYPE.test(type)) {
		await body.cancel();
		return undefined;
	}
	const chunks: Uint8Array[] = [];
	let size = 0;
	const reader = body.getReader();
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			size += chunk.value.byteLength;
			if (size > MAX_BYTES) {
				await reader.cancel();
				return undefined;
			}
			chunks.push(chunk.value);
		}
	} finally {
		reader.releaseLock();
	}
	if (size === 0) return undefined;
	return `data:${type};base64,${Buffer.concat(chunks, size).toString('base64')}`;
}
