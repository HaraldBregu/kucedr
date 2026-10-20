import { existsSync } from 'node:fs';
import path from 'node:path';
import { extensionsRoot } from './plugins_extensions_root';

/** The imported extension's folder, or undefined when `id` isn't an installed extension. */
export function extensionFolder(id: string): string | undefined {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return undefined;
	const folder = path.join(extensionsRoot(), id);
	return existsSync(path.join(folder, 'manifest.json')) ? folder : undefined;
}
