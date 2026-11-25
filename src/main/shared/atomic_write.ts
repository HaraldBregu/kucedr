import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function atomicWrite(
	filePath: string,
	content: string | Uint8Array,
	signal?: AbortSignal
): Promise<void> {
	const temporaryPath = path.join(
		path.dirname(filePath),
		`.${path.basename(filePath)}.${randomUUID()}.tmp`
	);
	try {
		await fs.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx', signal });
		await fs.rename(temporaryPath, filePath);
	} finally {
		await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
	}
}
