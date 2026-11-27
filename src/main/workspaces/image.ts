import { copyFileSync, mkdirSync, openSync, readSync, closeSync, rmSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { workspaceImages } from './images';
import { readWorkspaces } from './read';
import { writeWorkspaces } from './write';

export function setWorkspaceImage(id: string, source?: string): void {
	const records = readWorkspaces();
	const record = records.find((entry) => entry.id === id);
	if (!record) throw new Error('Workspace not found.');
	const directory = path.join(userDataLocation(), 'workspaces', 'images');
	const previous = record.image;
	delete record.image;
	if (source) {
		if (statSync(source).size > 5 * 1024 * 1024) throw new Error('Choose an image up to 5 MB.');
		const head = Buffer.alloc(12);
		const descriptor = openSync(source, 'r');
		try {
			readSync(descriptor, head, 0, 12, 0);
		} finally {
			closeSync(descriptor);
		}
		const extension = head.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
			? 'png'
			: head.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
				? 'jpg'
				: head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP'
					? 'webp'
					: undefined;
		if (!extension) throw new Error('Choose a PNG, JPEG or WebP image.');
		record.image = `${randomUUID()}.${extension}`;
		mkdirSync(directory, { recursive: true, mode: 0o700 });
		copyFileSync(source, path.join(directory, record.image));
	}
	writeWorkspaces(records);
	if (previous && path.basename(previous) === previous)
		rmSync(path.join(directory, previous), { force: true });
}
