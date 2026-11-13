import fs from 'node:fs/promises';
import Store from 'electron-store';
import type { MemoryService } from '../../shared/memory_types';
import type { Config } from '../agent/types';
import { getChatbotModel } from '../agent/agent_store';
import { LlmModel } from '../models/adapters/llm';
import { getProvider } from '../settings_store';
import { Memory } from './service';
import { defaultState } from './defaults';
import { memoryPath } from './path';
import { migrateWorkspaceMemory } from './migrate';
import { prepareMemorySettings } from './settings';
import { scanSources } from './sources';
import { validateConfiguration } from './configuration';
import type { MemoryState } from './types';
import { sessionMemoryPath } from './session_path';
import { writeMemoryFile } from './file';

export { memoryPath } from './path';

export function createMemory(configuration: () => Config): MemoryService {
	const store = new Store<MemoryState>({
		name: 'settings',
		cwd: prepareMemorySettings(),
		accessPropertiesByDotNotation: false,
		defaults: defaultState(),
	});
	const model = new LlmModel();
	return new Memory({
		store: {
			load: () => store.store,
			save: (state) => {
				store.store = state;
			},
		},
		selection: () => {
			const selected = getChatbotModel('textToText');
			return {
				providerId: selected.providerId,
				modelId: selected.modelId,
				modelOptions: selected.options,
			};
		},
		validate: validateConfiguration,
		prepare: () => migrateWorkspaceMemory(configuration()),
		sources: (sessionId) => scanSources(undefined, sessionId),
		exists: () =>
			fs
				.access(memoryPath())
				.then(() => true)
				.catch((error: NodeJS.ErrnoException) => {
					if (error.code === 'ENOENT') return false;
					throw error;
				}),
		read: () =>
			fs.readFile(memoryPath(), 'utf8').catch((error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return '';
				throw error;
			}),
		write: (markdown) => writeMemoryFile(memoryPath(), markdown),
		writeSession: (sessionId, markdown) =>
			writeMemoryFile(sessionMemoryPath(sessionId), markdown),
		removeSession: async (sessionId) => {
			await fs.rm(sessionMemoryPath(sessionId), { force: true });
		},
		infer: async (config, systemPrompt, request, signal) => {
			const provider = getProvider(config.providerId, 'models');
			if (!provider) throw new Error('Memory provider is not configured.');
			const response = await model.generate({
				provider: { id: config.providerId, name: provider.name, apiKey: provider.apiKey, baseURL: provider.baseUrl },
				model: config.modelId,
				options: config.modelOptions,
				maxTokens:
					typeof config.modelOptions.max_output_tokens === 'number'
						? config.modelOptions.max_output_tokens
						: typeof config.modelOptions.max_tokens === 'number'
							? config.modelOptions.max_tokens
							: 4096,
				signal,
				streaming: false,
				tools: [],
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: request },
				],
			});
			signal.throwIfAborted();
			if (response.stopReason === 'max_tokens')
				throw new Error('Memory model response was truncated. Increase its output tokens.');
			if (!response.content.trim()) throw new Error('Memory model returned an empty response.');
			return response.content;
		},
	});
}
