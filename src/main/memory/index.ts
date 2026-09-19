import fs from 'node:fs/promises';
import path from 'node:path';
import Store from 'electron-store';
import cron from 'node-cron';
import type { MemoryService } from '../../shared/memory_types';
import type { Config } from '../agent/types';
import { getChatbotModel } from '../agent/agent_store';
import { LlmModel } from '../models/adapters/llm';
import { getProvider } from '../settings_store';
import { atomicWrite } from '../shared/atomic_write';
import { Memory } from './service';
import { defaultState } from './defaults';
import { memoryPath } from './path';
import { migrateWorkspaceMemory } from './migrate';
import { prepareMemorySettings } from './settings';
import { normalizeJson } from './json';
import { scanSources } from './sources';
import { validateConfiguration } from './configuration';
import type { MemoryState } from './types';
import { sessionMemoryPath } from './session_path';
import { createMemoryFile } from './file';

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
		sources: () => scanSources(),
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
		write: createMemoryFile,
		writeSession: async (sessionId, markdown) => {
			const file = sessionMemoryPath(sessionId);
			await fs.mkdir(path.dirname(file), { recursive: true });
			await atomicWrite(file, markdown);
		},
		removeSession: async (sessionId) => {
			await fs.rm(sessionMemoryPath(sessionId), { force: true });
		},
		schedule: (expression, timezone, callback) => {
			const task = cron.schedule(expression, callback, { timezone, noOverlap: true });
			return {
				stop: () => {
					void task.destroy();
				},
			};
		},
		infer: async (config, systemPrompt, request, signal) => {
			const provider = getProvider(config.providerId, 'models');
			if (!provider) throw new Error('Memory provider is not configured.');
			const options =
				config.providerId.toLowerCase() === 'deepseek'
					? { ...config.modelOptions, response_format: { type: 'json_object' } }
					: config.modelOptions;
			for (let attempt = 0; attempt < 2; attempt += 1) {
				const response = await model.generate({
					provider: { id: config.providerId, apiKey: provider.apiKey, baseURL: provider.baseUrl },
					model: config.modelId,
					options,
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
						{
							role: 'user',
							content:
								attempt === 0
									? request
									: `${request}\nThe previous response was empty or invalid. Return one complete JSON object now.`,
						},
					],
				});
				signal.throwIfAborted();
				if (response.stopReason === 'max_tokens')
					throw new Error('Memory model JSON response was truncated. Increase its output tokens.');
				try {
					return normalizeJson(response.content);
				} catch {
					if (attempt === 1)
						throw new Error(
							response.content.trim()
								? 'Memory model returned invalid JSON after retry.'
								: 'Memory model returned an empty response after retry.'
						);
				}
			}
			throw new Error('Memory model did not return JSON.');
		},
	});
}
