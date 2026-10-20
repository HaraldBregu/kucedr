import { rm } from 'node:fs/promises';
import { extensionFolder } from './plugins_extensions_folder';

export async function removeExtension(id: string): Promise<void> {
	const folder = extensionFolder(id);
	if (!folder) throw new Error(`Extension "${id}" is not installed.`);
	await rm(folder, { recursive: true, force: true });
}
