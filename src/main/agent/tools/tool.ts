import { z } from 'zod';
import type { JSONSchema, JsonToolConfig, Tool, ToolConfig } from '../types';
import { builtinCapability } from '../execution/capability';

function toJsonSchema(schema: z.ZodType): JSONSchema {
	const jsonSchema = { ...z.toJSONSchema(schema) } as JSONSchema;
	delete jsonSchema.$schema;
	return jsonSchema;
}

export function tool<T extends z.ZodType>({
	id,
	name,
	description,
	inputExamples,
	timeoutMs = 10 * 60_000,
	maxOutputBytes = 200_000,
	planSafe,
	hardApproval,
	capability,
	policy,
	inputSchema,
	execute,
}: ToolConfig<T>): Tool {
	const validatedExamples = inputExamples?.map(
		(example) => inputSchema.parse(example) as Record<string, unknown>
	);
	return {
		id,
		name,
		description,
		inputExamples: validatedExamples,
		timeoutMs,
		maxOutputBytes,
		planSafe,
		policy,
		capability: capability ?? ((input) => builtinCapability(id, input)),
		hardApproval:
			typeof hardApproval === 'function'
				? (input) => hardApproval(inputSchema.parse(input))
				: hardApproval,
		schema: toJsonSchema(inputSchema),
		parseInput(input: unknown) {
			return inputSchema.parse(input) as Record<string, unknown>;
		},
		async run(input: Record<string, unknown>, signal?: AbortSignal) {
			return execute(inputSchema.parse(input), signal);
		},
	};
}

export function jsonTool({
	id,
	name,
	description,
	inputExamples,
	timeoutMs = 10 * 60_000,
	maxOutputBytes = 200_000,
	planSafe,
	hardApproval,
	capability,
	policy,
	parseInput,
	schema,
	execute,
}: JsonToolConfig): Tool {
	const validate = (input: unknown): Record<string, unknown> => {
		if (parseInput) return parseInput(input);
		if (!input || typeof input !== 'object' || Array.isArray(input)) {
			throw new Error('Tool input must be an object.');
		}
		return input as Record<string, unknown>;
	};
	return {
		id,
		name,
		description,
		inputExamples: inputExamples?.map(validate),
		timeoutMs,
		maxOutputBytes,
		planSafe,
		policy,
		hardApproval,
		capability: capability ?? ((input) => builtinCapability(id, input)),
		schema,
		parseInput(input: unknown) {
			return validate(input);
		},
		async run(input: Record<string, unknown>, signal?: AbortSignal) {
			return execute(parseInput ? parseInput(input) : input, signal);
		},
	};
}
