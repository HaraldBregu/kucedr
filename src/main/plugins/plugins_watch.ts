import { mkdirSync, watch } from 'node:fs';
import { bundledPluginsRoot } from './plugins_bundled_root';
import { pluginsRoot } from './plugins_root';
import { refreshPlugins } from './plugins_scan';

/** Reload plugins edited on disk; onChange fires after edits settle. */
export function watchPlugins(onChange: () => void): void {
	let timer: NodeJS.Timeout | undefined;
	mkdirSync(pluginsRoot(), { recursive: true });
	for (const root of [pluginsRoot(), bundledPluginsRoot()]) {
		try {
			watch(root, { recursive: true }, () => {
				refreshPlugins();
				clearTimeout(timer);
				timer = setTimeout(onChange, 100);
			});
		} catch {
			// ponytail: missing root or no watcher support; changes made through the app still refresh
		}
	}
}
