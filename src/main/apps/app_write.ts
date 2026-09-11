import { writeFileSync } from 'node:fs';
import { appManifestPath } from './app_manifest';
import { readAppManifest } from './app_read';
import type {
	AppWindowSettings,
	ResolvedAppWindowSettings,
} from '../../shared/app_window_settings';
import { resolveAppWindowSettings } from '../../shared/app_window_resolve';
import { isAppWindowSettings } from '../../shared/app_window_validate';

export function writeAppWindowSettings(
	id: string,
	settings: AppWindowSettings,
	appLocation?: string
): ResolvedAppWindowSettings {
	if (!isAppWindowSettings(settings)) throw new Error('Invalid app window settings.');
	const manifest = readAppManifest(id, appLocation);
	if (!manifest) throw new Error(`App manifest not found or invalid: ${id}`);
	const { window: _window, ...withoutWindow } = manifest;
	const next =
		Object.keys(settings).length === 0 ? withoutWindow : { ...withoutWindow, window: settings };
	writeFileSync(appManifestPath(id, appLocation), `${JSON.stringify(next, null, '\t')}\n`);
	return resolveAppWindowSettings(settings);
}
