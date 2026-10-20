import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { PluginExtension } from '../../shared/plugin_types';
import { extensionsRoot } from './plugins_extensions_root';
import { pluginIcon } from './plugins_icon';
import { readExtensionFolder } from './plugins_read_extension_folder';

/** Extensions imported on their own, outside any plugin; unreadable folders are skipped. */
export function listExtensions(): PluginExtension[] {
	const root = extensionsRoot();
	if (!existsSync(root)) return [];
	return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		if (!entry.isDirectory() || entry.name.startsWith('.')) return [];
		const folder = path.join(root, entry.name);
		try {
			const { icon, ...manifest } = readExtensionFolder(folder, entry.name);
			return [
				{
					...manifest,
					id: entry.name,
					...(icon && { icon: pluginIcon(path.join(folder, icon)) }),
				},
			];
		} catch {
			return [];
		}
	});
}
