import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { listApps } from './app_list';
import { appsRoot } from './app_root';
import type { App } from './app_types';
import { resourceRoot } from '../shared/resource_root';

export function ensureApps(appLocation?: string): App[] {
	const root = appsRoot(appLocation);
	mkdirSync(root, { recursive: true });
	if (appLocation === undefined) {
		const source = path.join(resourceRoot(), 'resources/apps/workspace');
		const target = path.join(root, 'workspace');
		const sourceEntry = path.join(source, 'dist/index.html');
		const targetEntry = path.join(target, 'dist/index.html');
		if (existsSync(sourceEntry) &&
			(!existsSync(targetEntry) || readFileSync(sourceEntry, 'utf8') !== readFileSync(targetEntry, 'utf8'))
		) {
			mkdirSync(target, { recursive: true });
			cpSync(path.join(source, 'dist'), path.join(target, 'dist'), { recursive: true });
			if (!existsSync(path.join(target, 'manifest.json'))) {
				cpSync(path.join(source, 'manifest.json'), path.join(target, 'manifest.json'));
			}
			if (!existsSync(path.join(target, 'assets/images/logo.png'))) {
				mkdirSync(path.join(target, 'assets/images'), { recursive: true });
				cpSync(path.join(source, 'assets/images/logo.png'), path.join(target, 'assets/images/logo.png'));
			}
		}
	}
	return listApps(appLocation);
}
