import type { ModelInputSchema } from '../../shared/model_types';

export function inputs(model: {
	supported_parameters?: unknown;
	default_parameters?: unknown;
	reasoning?: unknown;
}, templates: Readonly<Record<string, ModelInputSchema>>): Record<string, ModelInputSchema> {
	const parameters = Array.isArray(model.supported_parameters) ? model.supported_parameters : [];
	const defaults =
		model.default_parameters &&
		typeof model.default_parameters === 'object' &&
		!Array.isArray(model.default_parameters)
			? (model.default_parameters as Record<string, unknown>)
			: {};
	const inputs: Record<string, ModelInputSchema> = {};
	for (const name of parameters) {
		if (typeof name !== 'string' || !Object.hasOwn(templates, name)) continue;
		const schema = templates[name];
		if (name === 'reasoning') continue;
		const value = defaults[name];
		inputs[name] = {
			...schema,
			...((typeof value === schema.type ||
				(schema.type === 'integer' && typeof value === 'number' && Number.isInteger(value))) &&
			(typeof value !== 'number' || Number.isFinite(value))
				? { default: value as string | number | boolean }
				: {}),
		};
	}
	if (!parameters.includes('reasoning') && !parameters.includes('reasoning_effort')) return parsed;
	const reasoning =
		model.reasoning && typeof model.reasoning === 'object' && !Array.isArray(model.reasoning)
			? (model.reasoning as Record<string, unknown>)
			: {};
	const reasoningTemplate = templates.reasoning;
	const effortTemplate = reasoningTemplate?.properties?.effort;
	const knownEfforts = effortTemplate?.enum ?? [];
	const supported =
		reasoning.supported_efforts === null
			? knownEfforts
			: Array.isArray(reasoning.supported_efforts)
				? reasoning.supported_efforts
				: [];
	const efforts = knownEfforts.filter(
		(effort) => supported.includes(effort) && (effort !== 'none' || reasoning.mandatory !== true)
	);
	const properties: Record<string, ModelInputSchema> = {};
	if (efforts.length) {
		const defaultEffort = reasoning.default_effort;
		properties.effort = {
			...effortTemplate,
			enum: efforts,
			...(typeof defaultEffort === 'string' &&
			efforts.includes(defaultEffort)
				? { default: defaultEffort }
				: {}),
		};
	}
	if (reasoning.supports_max_tokens === true && reasoningTemplate?.properties?.max_tokens)
		properties.max_tokens = reasoningTemplate.properties.max_tokens;
	if (reasoning.mandatory === false && typeof reasoning.default_enabled === 'boolean' && reasoningTemplate?.properties?.enabled)
		properties.enabled = { ...reasoningTemplate.properties.enabled, default: reasoning.default_enabled };
	if (Object.keys(properties).length) inputs.reasoning = { ...reasoningTemplate, properties };
	return parsed;
}
