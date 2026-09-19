import fs from 'node:fs/promises';
import path from 'node:path';
import Store from 'electron-store';
import cron from 'node-cron';
import type { MemoryService } from '../../shared/memory_types';
import type { Config } from '../agent/types';
import { getChatbotModel } from '../agent/agent_store';
import { LlmModel } from '../models/adapters/llm';
import { getProvider } from '../settings_store';
import { userDataLocation } from '../shared/user_data_location';
import { atomicWrite } from '../shared/atomic_write';
import { Memory } from './service';
import { defaultState } from './defaults';
import { memoryPath } from './path';
import { scanSources } from './sources';
import { validateConfiguration } from './configuration';
import type { MemoryState } from './types';

export { memoryPath } from './path';

export function createMemory(configuration: () => Config): MemoryService {
	const store = new Store<MemoryState>({
		name: 'memory',
		cwd: path.join(userDataLocation(), 'settings'),
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
		sources: () => scanSources(configuration().location),
		read: () =>
			fs.readFile(memoryPath(configuration()), 'utf8').catch((error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return '';
				throw error;
			}),
		write: async (markdown) => {
			const file = memoryPath(configuration());
			await fs.mkdir(path.dirname(file), { recursive: true });
			await atomicWrite(file, markdown);
		},
		schedule: (expression, timezone, callback) => {
			const task = cron.schedule(expression, callback, { timezone, noOverlap: true });
			return {
				stop: () => {
					void task.destroy();
				},
			};
		},
		infer: async (config, prompt, signal) => {
			const provider = getProvider(config.providerId, 'models');
			if (!provider) throw new Error('Memory provider is not configured.');
			const response = await model.generate({
				provider: { id: config.providerId, apiKey: provider.apiKey, baseURL: provider.baseUrl },
				model: config.modelId,
				options: config.modelOptions,
				maxTokens: 4096,
				signal,
				tools: [],
				messages: [{ role: 'user', content: prompt }],
			});
			return response.content;
		},
	});
}
