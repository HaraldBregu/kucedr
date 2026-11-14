export function decodeText(bytes: Uint8Array, contentType: string): string {
	const charset = /charset=["']?([^;"'\s]+)/i.exec(contentType)?.[1];
	try {
		return new TextDecoder(charset ?? 'utf-8').decode(bytes);
	} catch {
		return new TextDecoder().decode(bytes);
	}
}
