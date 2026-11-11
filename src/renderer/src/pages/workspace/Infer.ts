import type { PluginScriptSchema } from '../../../../shared/plugin_types';

/** The schema of a value the script's `inputSchema` doesn't describe, so it still gets a field. */
export function inferScriptSchema(value: unknown): PluginScriptSchema {
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return { type: typeof value };
	if (Array.isArray(value)) return { type: 'array' };
	if (value === null || typeof value !== 'object') return {};
	return { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inferScriptSchema(item)])) };
}
