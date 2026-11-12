import { createHash } from 'node:crypto';
import type { LlmPrefixHashes } from '../../models/adapters/llm';
import type { Message, Tool } from '../types';

function hash(value: unknown): string {
	return createHash('sha256')
		.update(JSON.stringify(value) ?? '')
		.digest('hex')
		.slice(0, 10);
}

export function prefixHashes(
	systemPrompt: string | undefined,
	tools: readonly Tool[],
	messages: readonly Message[]
): LlmPrefixHashes {
	return {
		tools: hash(
			tools.map((tool) => ({ id: tool.id, description: tool.description, schema: tool.schema }))
		),
		system: hash(systemPrompt ?? ''),
		messages: messages.map(hash),
	};
}
