import type { ModelInputSchema } from '../../shared/model_types';

const PARAMETERS: Readonly<Record<string, ModelInputSchema>> = {
	temperature: { type: 'number', minimum: 0, maximum: 2 },
	top_p: { type: 'number', minimum: 0, maximum: 1 },
	top_k: { type: 'integer', minimum: 0 },
	min_p: { type: 'number', minimum: 0, maximum: 1 },
	top_a: { type: 'number', minimum: 0, maximum: 1 },
	frequency_penalty: { type: 'number', minimum: -2, maximum: 2 },
	presence_penalty: { type: 'number', minimum: -2, maximum: 2 },
	repetition_penalty: { type: 'number' },
	seed: { type: 'integer' },
	logprobs: { type: 'boolean' },
	top_logprobs: { type: 'integer', minimum: 0, maximum: 20 },
	parallel_tool_calls: { type: 'boolean' },
	include_reasoning: { type: 'boolean' },
	verbosity: { type: 'string', enum: ['low', 'medium', 'high'] },
};

const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

export function openrouterInputs(model: {
	supported_parameters?: unknown;
	default_parameters?: unknown;
	reasoning?: unknown;
}): Record<string, ModelInputSchema> {
	const parameters = Array.isArray(model.supported_parameters) ? model.supported_parameters : [];
	const defaults =
		model.default_parameters &&
		typeof model.default_parameters === 'object' &&
		!Array.isArray(model.default_parameters)
			? (model.default_parameters as Record<string, unknown>)
			: {};
	const inputs: Record<string, ModelInputSchema> = {};
	for (const name of parameters) {
		if (typeof name !== 'string' || !Object.hasOwn(PARAMETERS, name)) continue;
		const schema = PARAMETERS[name];
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
	if (!parameters.includes('reasoning') && !parameters.includes('reasoning_effort')) return inputs;
	const reasoning =
		model.reasoning && typeof model.reasoning === 'object' && !Array.isArray(model.reasoning)
			? (model.reasoning as Record<string, unknown>)
			: {};
	const supported =
		reasoning.supported_efforts === null
			? EFFORTS
			: Array.isArray(reasoning.supported_efforts)
				? reasoning.supported_efforts
				: [];
	const efforts = EFFORTS.filter(
		(effort) => supported.includes(effort) && (effort !== 'none' || reasoning.mandatory !== true)
	);
	const properties: Record<string, ModelInputSchema> = {};
	if (efforts.length) {
		const defaultEffort = reasoning.default_effort;
		properties.effort = {
			type: 'string',
			enum: efforts,
			...(typeof defaultEffort === 'string' &&
			efforts.includes(defaultEffort as (typeof efforts)[number])
				? { default: defaultEffort }
				: {}),
		};
	}
	if (reasoning.supports_max_tokens === true)
		properties.max_tokens = { type: 'integer', minimum: 0 };
	if (reasoning.mandatory === false && typeof reasoning.default_enabled === 'boolean')
		properties.enabled = { type: 'boolean', default: reasoning.default_enabled };
	if (Object.keys(properties).length) inputs.reasoning = { type: 'object', properties };
	return inputs;
}
