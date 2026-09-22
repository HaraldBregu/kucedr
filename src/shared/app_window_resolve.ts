import { APP_WINDOW_DEFAULTS, type AppWindowSettings, type ResolvedAppWindowSettings } from './app_window_settings';
import { isAppWindowSettings } from './app_window_validate';

export function resolveAppWindowSettings(...layers: AppWindowSettings[]): ResolvedAppWindowSettings {
	let resolved = { ...APP_WINDOW_DEFAULTS };
	for (const settings of layers) {
		if (!isAppWindowSettings(settings)) throw new Error('Invalid app window settings.');
		const width = settings.width ?? Math.max(resolved.width, settings.minWidth ?? resolved.minWidth);
		const height = settings.height ?? Math.max(resolved.height, settings.minHeight ?? resolved.minHeight);
		resolved = {
			...resolved,
			...settings,
			width,
			height,
			minWidth: settings.minWidth ?? Math.min(resolved.minWidth, width),
			minHeight: settings.minHeight ?? Math.min(resolved.minHeight, height),
		};
	}
	return resolved;
}
