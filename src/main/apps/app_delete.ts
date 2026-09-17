import { rmSync } from 'node:fs';
import path from 'node:path';
import { isAppId } from './app_id';
import { appsRoot } from './app_root';
import { removeDebugApp } from './app_debug_remove';

export function deleteApp(id: string, appLocation?: string): void {
	if (appLocation === undefined && removeDebugApp(id)) return;
	const root = path.resolve(appsRoot(appLocation));
	const target = path.resolve(root, id);
	if (!isAppId(id) || path.dirname(target) !== root) {
		throw new Error('Invalid app ID.');
	}
	rmSync(target, { recursive: true, force: true });
}
