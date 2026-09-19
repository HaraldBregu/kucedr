import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWrite } from '../shared/atomic_write';
import { memoryPath } from './path';

export async function createMemoryFile(markdown: string): Promise<void> {
	const file = memoryPath();
	await fs.mkdir(path.dirname(file), { recursive: true });
	await atomicWrite(file, markdown);
}
