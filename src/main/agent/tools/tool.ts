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
	category,
	name,
	description,
	inputExamples,
	timeoutMs = 10 * 60_000,
	maxOutputBytes = 200_000,
	readOnly,
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
		category,
		name,
		description,
		inputExamples: validatedExamples,
		timeoutMs,
		maxOutputBytes,
		readOnly,
		policy,
		capability: capability ?? ((input) => builtinCapability(id, input)),
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
	category,
	name,
	description,
	inputExamples,
	timeoutMs = 10 * 60_000,
	maxOutputBytes = 200_000,
	readOnly,
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
		category,
		name,
		description,
		inputExamples: inputExamples?.map(validate),
		timeoutMs,
		maxOutputBytes,
		readOnly,
		policy,
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
