import type { PluginScriptSchema } from '@shared/plugin_types';

export interface Property {
	readonly key: string;
	readonly title: string;
	readonly description?: string;
	readonly type?: string;
	readonly required: boolean;
}

/** Flattens a script's input schema into dotted property rows, descending into objects and array items. */
export function properties(schema: PluginScriptSchema | undefined, parent = ''): Property[] {
	return Object.entries(schema?.properties ?? {}).flatMap(([name, property]) => {
		const key = parent ? `${parent}.${name}` : name;
		return [
			{
				key,
				title: property.title ?? name,
				description: property.description,
				type: property.type,
				required: schema?.required?.includes(name) ?? false,
			},
			...properties(property.properties ? property : property.items, key),
		];
	});
}
