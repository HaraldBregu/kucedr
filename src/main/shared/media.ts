import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mediaDirectory } from './media_directory';

export async function saveMedia(
	prefix: string,
	extension: string,
	base64: string,
	directory?: string,
	signal?: AbortSignal
): Promise<string> {
	signal?.throwIfAborted();
	const targetDir = mediaDirectory(directory);
	await fs.mkdir(targetDir, { recursive: true });
	signal?.throwIfAborted();
	const filePath = path.join(targetDir, `${prefix}-${Date.now()}-${randomUUID()}.${extension}`);
	await fs.writeFile(filePath, Buffer.from(base64, 'base64'), { signal });
	return filePath;
}
