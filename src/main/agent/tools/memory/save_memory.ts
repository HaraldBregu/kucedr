import { z } from 'zod';
import { MAX_MEMORY_FACT_LENGTH, saveMemory } from '../../memory';
import type { Config, Tool } from '../../types';
import { tool } from '../tool';

export function saveMemoryTool(config: Config): Tool {
	return tool({
		id: 'save_memory',
		name: 'Save memory',
		description:
			'Save one concise, durable user fact to persistent memory. Save automatically when the user shares clearly useful long-term context, such as a stable preference, personal profile detail, ongoing project, commitment, or future plan. Do not save secrets, sensitive personal data, third-party private data, inferred facts, or transient conversation details.',
		inputSchema: z.object({
			fact: z
				.string()
				.trim()
				.min(1)
				.max(MAX_MEMORY_FACT_LENGTH)
				.describe('The fact to remember, as one short self-contained sentence.'),
		}),
		execute: ({ fact }) => saveMemory(config, fact),
	});
}
