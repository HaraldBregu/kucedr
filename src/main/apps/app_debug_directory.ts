import path from 'node:path';
import { debugAppPaths } from './app_debug_paths';

export function debugAppDirectory(id: string): string | undefined {
	return debugAppPaths().find((directory) => path.basename(directory) === id);
}
