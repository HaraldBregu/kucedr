import type { ModelInputSchema } from '../../shared/model_types';

export function validateOption(value: unknown, schema: ModelInputSchema): boolean {
	if (schema.enum && !schema.enum.includes(value as string | number)) return false;
	if (schema.oneOf && !schema.oneOf.some((choice) => choice.const === value)) return false;
	if (schema.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) return false;
	if (schema.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) return false;
	if (schema.type === 'string' && typeof value !== 'string') return false;
	if (schema.type === 'boolean' && typeof value !== 'boolean') return false;
	if (typeof value === 'number' && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) return false;
	if (schema.type === 'array') return Array.isArray(value) && (!schema.items || value.every((item) => validateOption(item, schema.items!)));
	if (schema.type === 'object') {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
		return Object.entries(value).every(([key, item]) => Boolean(schema.properties?.[key]) && validateOption(item, schema.properties![key]));
	}
	return true;
}
