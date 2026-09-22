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
	timeoutMs = 10 * 60_000,
	maxOutputBytes = 200_000,
	planSafe,
	hardApproval,
	capability,
	policy,
	inputSchema,
	execute,
}: ToolConfig<T>): Tool {
	return {
		id,
		name,
		description,
		timeoutMs,
		maxOutputBytes,
		planSafe,
		policy,
		capability: capability ?? ((input) => builtinCapability(id, input)),
		hardApproval: typeof hardApproval === 'function'
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
	return {
		id,
		name,
		description,
		timeoutMs,
		maxOutputBytes,
		planSafe,
		policy,
		hardApproval,
		capability: capability ?? ((input) => builtinCapability(id, input)),
		schema,
		parseInput(input: unknown) {
			if (parseInput) return parseInput(input);
			if (!input || typeof input !== 'object' || Array.isArray(input)) {
				throw new Error('Tool input must be an object.');
			}
			return input as Record<string, unknown>;
		},
		async run(input: Record<string, unknown>, signal?: AbortSignal) {
			return execute(parseInput ? parseInput(input) : input, signal);
		},
	};
}
