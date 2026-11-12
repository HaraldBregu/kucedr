import OpenAI from 'openai';
import { loadModels } from '../../../models';
import { getProvider } from '../../../settings_store';
import type { JSONSchema, Tool } from '../../types';
import { mcpToolName } from '../mcp/name';
import { mcpInputParser } from '../mcp/schema';
import { jsonTool } from '../tool';

export function modelTools(): Tool[] {
	const tools: Tool[] = [];
	const used = new Set<string>();
	for (const model of loadModels()) {
		if (!model.metadata?.operations || !model.url || !getProvider(model.provider.id)?.apiKey.trim()) continue;
		for (const [operation, contract] of Object.entries(model.metadata.operations)) {
			if (!/^\/[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(contract.endpoint)) continue;
			const rawName = mcpToolName(model.provider.id, `${model.id}__${operation}`, used);
			used.add(rawName);
			const schema = contract.inputSchema as JSONSchema;
			const parseInput = mcpInputParser(schema);
			tools.push(jsonTool({
				id: rawName.replace(/^mcp__/, 'mdl__'),
				category: 'integration',
				name: `${model.name}: ${operation}`,
				description: contract.description,
				capability: { effects: ['external', 'paid'] },
				schema,
				parseInput,
				execute: async (input, signal) => {
					const provider = getProvider(model.provider.id);
					const apiKey = provider?.apiKey.trim();
					if (!apiKey) throw new Error(`${model.provider.name} API key not configured.`);
					const baseURL = provider?.baseUrl && provider.baseUrl !== model.provider.baseUrl
						? provider.baseUrl : model.url;
					const client = new OpenAI({ apiKey, baseURL });
					return client.post(contract.endpoint, {
						body: { ...input, model: model.id },
						signal,
					});
				},
			}));
		}
	}
	return tools;
}
