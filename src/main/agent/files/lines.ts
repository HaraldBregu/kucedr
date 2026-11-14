import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { validateFilePath } from './validate';
import { decodeUtf8 } from './text';

export async function readLines(
	filePath: string,
	start: number,
	count: number | undefined,
	maxBytes: number,
	signal?: AbortSignal
): Promise<string> {
	signal?.throwIfAborted();
	const identities = validateFilePath(filePath);
	const selected = identities.at(-1);
	const handle = await open(
		filePath,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
	);
	try {
		const stat = await handle.stat();
		if (!stat.isFile()) throw new Error(`Expected a regular file: ${filePath}`);
		if (stat.dev !== selected?.dev || stat.ino !== selected.ino)
			throw new Error(`File identity changed before reading: ${filePath}`);
		const lines: string[] = [];
		let index = 0;
		let total = 0;
		for await (const line of handle.readLines({ encoding: 'latin1', autoClose: false })) {
			signal?.throwIfAborted();
			if (index++ < start) continue;
			const bytes = Buffer.from(line, 'latin1');
			total += bytes.length + 1;
			if (total > maxBytes) throw new Error(`Selected lines exceed the ${maxBytes}-byte limit: ${filePath}`);
			lines.push(decodeUtf8(bytes, filePath));
			if (lines.length === count) break;
		}
		return lines.join('\n');
	} finally {
		await handle.close();
	}
}
