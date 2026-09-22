import type { AppWindowSettings } from './app_window_settings';

export function isAppWindowSettings(value: unknown): value is AppWindowSettings {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const settings = value as Record<string, unknown>;
	for (const [key, entry] of Object.entries(settings)) {
		if (['width', 'height', 'minWidth', 'minHeight'].includes(key)) {
			if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 1 || entry > 32768) {
				return false;
			}
		} else if (key === 'resizable' || key === 'maximizable') {
			if (typeof entry !== 'boolean') return false;
		} else {
			return false;
		}
	}
	return !(
		(typeof settings.width === 'number' && typeof settings.minWidth === 'number' &&
			settings.minWidth > settings.width) ||
		(typeof settings.height === 'number' && typeof settings.minHeight === 'number' &&
			settings.minHeight > settings.height)
	);
}
