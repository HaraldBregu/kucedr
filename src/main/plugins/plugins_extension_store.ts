import path from 'node:path';
import { AppValueStorage } from '../apps/app_values';
import { isAppId } from '../apps/app_id';
import { extensionsRoot } from './plugins_extensions_root';
import { pluginsRoot } from './plugins_root';

const stores = new Map<string, AppValueStorage>();

/** Each extension's isolated `<id>/data/store.json`: under `extensions/`, or `plugins/.data/<plugin-id>/` for plugin extensions. */
export function extensionStore(pluginId?: string): AppValueStorage {
	if (pluginId !== undefined && !isAppId(pluginId)) throw new Error('Invalid plugin ID.');
	const root = pluginId ? path.join(pluginsRoot(), '.data', pluginId) : extensionsRoot();
	const existing = stores.get(root);
	if (existing) return existing;
	const created = new AppValueStorage(root);
	stores.set(root, created);
	return created;
}
