import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PLUGIN_SERVICE_TYPES } from '../../shared/plugin_types';

/** Reads `services/<id>/manifest.json`: the services a provider plugin offers, keyed by their `type`. */
export function readPluginServices(directory: string): {
	web_search?: unknown[];
	storage_services?: unknown[];
} {
	const servicesDirectory = path.join(directory, 'services');
	if (!existsSync(servicesDirectory)) return {};
	const web_search: unknown[] = [];
	const storage_services: unknown[] = [];
	for (const entry of readdirSync(servicesDirectory, { withFileTypes: true })) {
		if (entry.name.startsWith('.') || entry.name === 'README.md') continue;
		if (!entry.isDirectory()) throw new Error(`services/${entry.name} must be a folder.`);
		const file = path.join(servicesDirectory, entry.name, 'manifest.json');
		if (!existsSync(file)) throw new Error(`services/${entry.name}/manifest.json is missing.`);
		let value: { id?: unknown; type?: unknown };
		try {
			value = JSON.parse(readFileSync(file, 'utf8'));
		} catch (error) {
			throw new Error(`services/${entry.name}/manifest.json is not valid JSON.`, { cause: error });
		}
		if (value?.id !== entry.name) {
			throw new Error(`services/${entry.name}/manifest.json must have id "${entry.name}".`);
		}
		if (!PLUGIN_SERVICE_TYPES.includes(value?.type as (typeof PLUGIN_SERVICE_TYPES)[number])) {
			throw new Error(
				`services/${entry.name}/manifest.json: type must be one of ${PLUGIN_SERVICE_TYPES.join(', ')}.`
			);
		}
		(value.type === 'STORAGE' ? storage_services : web_search).push(value);
	}
	return {
		...(web_search.length && { web_search }),
		...(storage_services.length && { storage_services }),
	};
}
