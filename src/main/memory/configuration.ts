import { z } from 'zod';
import type { MemoryConfig } from '../../shared/memory_types';
import { findModel } from '../models';
import { validateOption } from './options';

const schema = z
	.object({
		enabled: z.boolean(),
		providerId: z.string().max(200),
		modelId: z.string().max(300),
		modelOptions: z.record(z.string(), z.unknown()),
		memoryType: z.enum(['facts', 'summaries', 'both']),
	})
	.strict();

export function validateConfiguration(config: MemoryConfig): void {
	schema.parse(config);
	if (!config.providerId && !config.modelId && !Object.keys(config.modelOptions).length) return;
	const model = findModel(config.providerId, 'llm', config.modelId);
	if (!model) throw new Error('Select a supported memory model.');
	for (const [key, value] of Object.entries(config.modelOptions)) {
		const input = model.metadata?.inputs[key];
		if (!input || !validateOption(value, input))
			throw new Error(`Unsupported memory model option: ${key}`);
	}
}
