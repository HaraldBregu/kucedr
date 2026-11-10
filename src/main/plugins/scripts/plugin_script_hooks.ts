import { pluginScripts } from './plugin_script_list';
import { pluginScriptSettings } from './plugin_script_settings';
import { spawnPluginScript } from './plugin_script_spawn';

/** Runs every enabled, set-up hook script of `type` with the event and its saved settings; failures are only logged. */
export async function runPluginHooks(
	type: 'PRE_TOOL_USE' | 'POST_TOOL_USE' | 'PRE_MODEL_TURN' | 'POST_MODEL_TURN',
	event: Record<string, unknown>
): Promise<void> {
	try {
		const results = await Promise.allSettled(
			pluginScripts(type).flatMap((script) => {
				const properties = script.settings?.inputSchema.properties ?? {};
				const settings = {
					...Object.fromEntries(
						Object.entries(properties).flatMap(([key, property]) =>
							property.type === 'boolean' && property.default !== undefined
								? [[key, String(property.default)]]
								: []
						)
					),
					...pluginScriptSettings(script.name),
				};
				const required = script.settings?.inputSchema.required ?? [];
				if (required.some((key) => !settings[key])) return [];
				return [
					spawnPluginScript(script, { event: type, ...event, settings }).catch((error: unknown) => {
						throw new Error(
							`${script.plugin.id}/${script.name}: ${error instanceof Error ? error.message : error}`
						);
					}),
				];
			})
		);
		for (const result of results) {
			if (result.status === 'rejected') console.warn(`[plugins] hook ${result.reason.message}`);
		}
	} catch (error) {
		console.warn(`[plugins] hooks ${type}: ${error instanceof Error ? error.message : error}`);
	}
}
