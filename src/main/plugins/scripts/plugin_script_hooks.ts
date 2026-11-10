import { pluginScripts } from './plugin_script_list';
import { spawnPluginScript } from './plugin_script_spawn';

/** Runs every enabled hook script of `type` with the event; failures are only logged. */
export async function runPluginHooks(
	type: 'PRE_TOOL_USE' | 'POST_TOOL_USE' | 'PRE_MODEL_TURN' | 'POST_MODEL_TURN',
	event: Record<string, unknown>
): Promise<void> {
	try {
		const results = await Promise.allSettled(
			pluginScripts(type).map((script) =>
				spawnPluginScript(script, { event: type, ...event }).catch((error: unknown) => {
					throw new Error(
						`${script.plugin.id}/${script.name}: ${error instanceof Error ? error.message : error}`
					);
				})
			)
		);
		for (const result of results) {
			if (result.status === 'rejected') console.warn(`[plugins] hook ${result.reason.message}`);
		}
	} catch (error) {
		console.warn(`[plugins] hooks ${type}: ${error instanceof Error ? error.message : error}`);
	}
}
