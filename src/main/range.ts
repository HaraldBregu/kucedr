import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { workspaceFileType } from '../shared/workspace';

/** A 206 for a single `bytes=` range, since net.fetch serves file: URLs whole and media can't seek without one. */
export async function rangeResponse(filePath: string, header: string): Promise<Response | null> {
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match || (!match[1] && !match[2])) return null;
	const { size } = await fs.stat(filePath);
	const start = match[1] ? Number(match[1]) : Math.max(size - Number(match[2]), 0);
	const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
	if (start >= size || start > end) {
		return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
	}
	return new Response(Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream, {
		status: 206,
		headers: {
			'Accept-Ranges': 'bytes',
			'Content-Length': String(end - start + 1),
			'Content-Range': `bytes ${start}-${end}/${size}`,
			'Content-Type': workspaceFileType(filePath).mimeType ?? 'application/octet-stream',
		},
	});
}
