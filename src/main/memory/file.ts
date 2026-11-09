import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWrite } from '../shared/atomic_write';

export async function writeMemoryFile(file: string, markdown: string): Promise<void> {
	await fs.mkdir(path.dirname(file), { recursive: true });
	await atomicWrite(file, markdown);
}
