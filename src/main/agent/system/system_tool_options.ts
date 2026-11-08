import type { JSONSchema } from '../types';

type Property = { enum?: unknown[]; minimum?: number; maximum?: number; type?: string };

export function toolOptions(schema: JSONSchema | undefined): string {
	const properties = (schema as { properties?: Record<string, Property> } | undefined)?.properties;
	if (!properties || Object.keys(properties).length === 0) return '';
	const options = Object.entries(properties).map(([name, property]) => {
		if (property.enum) return `\`${name}\` (${property.enum.join(' | ')})`;
		if (property.minimum !== undefined || property.maximum !== undefined)
			return `\`${name}\` (${property.minimum ?? ''}–${property.maximum ?? ''})`;
		return `\`${name}\``;
	});
	return ` Options: ${options.join(', ')}.`;
}
