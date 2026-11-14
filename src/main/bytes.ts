export async function responseBytes(
	response: Response,
	limit: number
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
	if (!response.body) return { bytes: new Uint8Array(), truncated: false };
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	let truncated = false;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (size + value.byteLength > limit) {
			chunks.push(value.subarray(0, limit - size));
			size = limit;
			truncated = true;
			await reader.cancel();
			break;
		}
		size += value.byteLength;
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return { bytes, truncated };
}
