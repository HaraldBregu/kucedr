import { pluginSettings } from '../plugins/plugins_settings';
import type { PluginScript } from '../plugins/scripts/plugin_script_list';
import { forkVectorScript } from './fork';
import type { VectorDatabaseAdapter } from './vector_types';

/** A VECTOR script as a vector database; its API key is the plugin setting named after the script. */
export function vectorScriptAdapter(script: PluginScript): VectorDatabaseAdapter {
	return {
		service: {
			providerId: 'script',
			databaseId: script.name,
			providerName: script.plugin.name,
			databaseName: script.title,
		},
		apiKey: () => pluginSettings(script.plugin.id)[script.name],
		consentRecipient: (apiKey, indexName) => ['script', script.name, indexName, apiKey],
		upload: async ({ apiKey, indexName, generation, dimensions, records, signal, assertCurrent }) => {
			assertCurrent();
			await forkVectorScript(
				script,
				{
					operation: 'upload',
					provider: { apiKey },
					indexName,
					generation,
					dimensions,
					records: records.map(({ id, path, text, vector }) => ({ id, path, text, vector })),
				},
				signal
			);
			assertCurrent();
		},
		discard: (apiKey, indexName, generation, signal) =>
			forkVectorScript(
				script,
				{ operation: 'discard', provider: { apiKey }, indexName, generation },
				signal
			),
		purge: async (apiKey, indexName, generation) =>
			(
				await forkVectorScript<{ deleted: number }>(script, {
					operation: 'purge',
					provider: { apiKey },
					indexName,
					generation,
				})
			).deleted,
	};
}
