import { isAppEntry } from './app_entry_validate';
import { isAppImage } from './app_image_validate';
import type { AppManifest } from './app_types';
import { isAppWindowSettings } from '../../shared/app_window_validate';

export function isAppManifest(value: unknown): value is AppManifest {
	if (!value || typeof value !== 'object') return false;
	const manifest = value as Record<string, unknown>;
	const metadata = manifest.metadata as Record<string, unknown> | undefined;
	return (
		typeof manifest.title === 'string' &&
		manifest.title.trim().length > 0 &&
		typeof manifest.description === 'string' &&
		manifest.description.trim().length > 0 &&
		Boolean(metadata) &&
		typeof metadata === 'object' &&
		!Array.isArray(metadata) &&
		typeof metadata.version === 'string' &&
		metadata.version.trim().length > 0 &&
		typeof metadata.category === 'string' &&
		metadata.category.trim().length > 0 &&
		isAppEntry(metadata.entry) &&
		(metadata.image === undefined || isAppImage(metadata.image)) &&
		(manifest.window === undefined || isAppWindowSettings(manifest.window))
	);
}
