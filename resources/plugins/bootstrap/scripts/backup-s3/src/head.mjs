import { promises as fs } from 'node:fs';

export async function head(file, length) {
	const handle = await fs.open(file, 'r');
	try {
		const { buffer, bytesRead } = await handle.read(Buffer.alloc(length), 0, length, 0);
		return buffer.subarray(0, bytesRead);
	} finally {
		await handle.close();
	}
}
