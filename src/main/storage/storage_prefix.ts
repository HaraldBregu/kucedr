import path from 'node:path';

export function storagePrefix(localPath: string): string {
	return `${path.basename(path.resolve(localPath))}/`;
}
