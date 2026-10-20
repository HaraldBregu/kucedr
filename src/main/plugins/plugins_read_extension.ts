import path from 'node:path';
import type { ExtensionManifest } from '../../shared/plugin_manifest';
import { readExtensionFolder } from './plugins_read_extension_folder';

export function readPluginExtension(directory: string, id: string): ExtensionManifest {
	return readExtensionFolder(path.join(directory, 'extensions', id), `extensions/${id}`);
}
