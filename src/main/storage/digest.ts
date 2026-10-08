import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export async function fileDigest(filePath: string): Promise<string> {
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(filePath)) hash.update(chunk);
	return hash.digest('hex');
}
