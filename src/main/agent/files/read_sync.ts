import fs from 'node:fs';
import { validateFilePath } from './validate';

export function readFileBoundedSync(filePath: string, maxBytes: number): { content: Buffer; mode: number } {
	const identities = validateFilePath(filePath);
	const selected = identities.at(-1);
	const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
	try {
		const stat = fs.fstatSync(descriptor);
		if (!stat.isFile()) throw new Error('File history requires a regular file.');
		if (stat.size > maxBytes) throw new Error(`File history exceeds the ${maxBytes}-byte limit.`);
		if (stat.dev !== selected?.dev || stat.ino !== selected.ino || JSON.stringify(validateFilePath(filePath)) !== JSON.stringify(identities))
			throw new Error('File history path changed before reading.');
		const chunks: Buffer[] = [];
		let total = 0;
		while (true) {
			const buffer = Buffer.alloc(Math.min(64 * 1024, maxBytes - total + 1));
			const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
			if (count === 0) break;
			total += count;
			if (total > maxBytes) throw new Error(`File history exceeds the ${maxBytes}-byte limit.`);
			chunks.push(buffer.subarray(0, count));
		}
		const after = fs.fstatSync(descriptor);
		if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || JSON.stringify(validateFilePath(filePath)) !== JSON.stringify(identities))
			throw new Error('File changed while capturing history.');
		return { content: Buffer.concat(chunks, total), mode: stat.mode };
	} finally { fs.closeSync(descriptor); }
}
