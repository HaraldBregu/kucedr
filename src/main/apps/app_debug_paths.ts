import path from 'node:path';
import { debugAppsStore } from './app_debug_store';

export function debugAppPaths(): string[] {
	return debugAppsStore
		.get('paths')
		.filter((value): value is string => typeof value === 'string' && path.isAbsolute(value))
		.map((value) => path.resolve(value));
}
