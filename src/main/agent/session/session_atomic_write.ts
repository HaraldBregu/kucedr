import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { seal } from '../../vault/seal';

export function atomicWriteFile(filePath: string, content: string | Uint8Array): void {
	const temporaryPath = path.join(
		path.dirname(filePath),
		`.${path.basename(filePath)}.${randomUUID()}.tmp`
	);
	try {
		fs.writeFileSync(temporaryPath, seal(content));
		fs.renameSync(temporaryPath, filePath);
	} finally {
		if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
	}
}
