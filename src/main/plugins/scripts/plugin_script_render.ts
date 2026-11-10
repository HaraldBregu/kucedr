import { pluginScripts } from './plugin_script_list';
import { spawnPluginScript } from './plugin_script_spawn';

// ponytail: unbounded in-memory cache, add an LRU if many distinct renders pile up
const cache = new Map<string, Promise<string>>();

/** Runs a plugin script with `{ input, theme }` on stdin and returns the HTML it prints. */
export function renderPluginScript(
	name: string,
	input: unknown,
	theme: 'light' | 'dark'
): Promise<string> {
	const script = pluginScripts().find((candidate) => candidate.name === name);
	if (!script) return Promise.reject(new Error(`No plugin script named "${name}".`));
	const key = JSON.stringify([script.directory, name, input, theme]);
	const cached = cache.get(key);
	if (cached) return cached;

	const result = spawnPluginScript(script, { input, theme });
	cache.set(key, result);
	result.catch(() => cache.delete(key));
	return result;
}
