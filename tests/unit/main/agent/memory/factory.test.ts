jest.mock('electron-store', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('node:fs', () => ({ watch: jest.fn() }));
jest.mock('node:fs/promises', () => ({ access: jest.fn(), readFile: jest.fn(), mkdir: jest.fn(), rm: jest.fn() }));
jest.mock('../../../../../src/main/agent/agent_store', () => ({ getChatbotModel: jest.fn() }));
jest.mock('../../../../../src/main/models/adapters/llm', () => ({ LlmModel: jest.fn() }));
jest.mock('../../../../../src/main/settings_store', () => ({ getProvider: jest.fn() }));
jest.mock('../../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => '/home/test/.kucedr',
}));
jest.mock('../../../../../src/main/shared/atomic_write', () => ({ atomicWrite: jest.fn() }));
jest.mock('../../../../../src/main/memory/sources', () => ({ scanSources: jest.fn() }));
jest.mock('../../../../../src/main/memory/configuration', () => ({
	validateConfiguration: jest.fn(),
}));
jest.mock('../../../../../src/main/memory/settings', () => ({
	prepareMemorySettings: () => '/home/test/.kucedr/memory',
}));
jest.mock('../../../../../src/main/memory/migrate', () => ({ migrateWorkspaceMemory: jest.fn() }));

import fs from 'node:fs/promises';
import { watch } from 'node:fs';
import Store from 'electron-store';
import { createMemory } from '../../../../../src/main/memory';
import { getChatbotModel } from '../../../../../src/main/agent/agent_store';
import { LlmModel } from '../../../../../src/main/models/adapters/llm';
import { getProvider } from '../../../../../src/main/settings_store';
import { scanSources } from '../../../../../src/main/memory/sources';
import type { MemoryState } from '../../../../../src/main/memory/types';
import { atomicWrite } from '../../../../../src/main/shared/atomic_write';

it('persists independent configuration and invokes the configured provider directly without tools', async () => {
	let persisted: MemoryState | undefined;
	(Store as unknown as jest.Mock).mockImplementation((options: { defaults: MemoryState }) => ({
		get store() {
			return persisted ?? options.defaults;
		},
		set store(state: MemoryState) {
			persisted = structuredClone(state);
		},
	}));
	const generate = jest.fn().mockResolvedValue({ content: '# Memory\n- Prefers TypeScript.\n' });
	(LlmModel as jest.Mock).mockImplementation(() => ({ generate }));
	(fs.readFile as jest.Mock).mockRejectedValue(
		Object.assign(new Error('missing'), { code: 'ENOENT' })
	);
	(fs.access as jest.Mock).mockResolvedValue(undefined);
	(scanSources as jest.Mock).mockResolvedValue([]);
	(getChatbotModel as jest.Mock).mockReturnValue({
		providerId: 'initial',
		modelId: 'initial-model',
		options: {},
	});
	(getProvider as jest.Mock).mockReturnValue({
		apiKey: 'provider-secret',
		baseUrl: 'https://provider.invalid',
	});
	const close = jest.fn();
	(watch as jest.Mock).mockReturnValue({ close });
	const first = createMemory(() => ({ location: '/home/test/.kucedr/workspace' }));
	await first.start();
	const sessionId = '11111111-1111-4111-8111-111111111111';
	await first.capture(sessionId, [{ role: 'user', content: 'Remember this run.' }]);
	expect(atomicWrite).toHaveBeenCalledWith(
		`/home/test/.kucedr/memory/${sessionId}.md`,
		expect.stringContaining('> Remember this run.')
	);
	expect(scanSources).toHaveBeenCalledWith();
	await first.edit('# Memory\n');
	expect(atomicWrite).toHaveBeenCalledWith('/home/test/.kucedr/memory/MEMORY.md', '# Memory\n');
	expect(Store).toHaveBeenCalledWith(
		expect.objectContaining({ name: 'settings', cwd: '/home/test/.kucedr/memory' })
	);
	await first.configure({
		providerId: 'deepseek',
		modelId: 'deepseek-flash',
		modelOptions: { temperature: 0 },
	});
	await first.stop();
	expect(close).toHaveBeenCalled();
	(getChatbotModel as jest.Mock).mockReturnValue({
		providerId: 'new-chat',
		modelId: 'new-chat-model',
		options: {},
	});
	const restarted = createMemory(() => ({ location: '/home/test/.kucedr/workspace' }));
	await restarted.start();
	expect(restarted.getConfig()).toMatchObject({
		providerId: 'deepseek',
		modelId: 'deepseek-flash',
		modelOptions: { temperature: 0 },
	});
	(scanSources as jest.Mock).mockResolvedValue([
		{
			id: 'session',
			messages: [{ fingerprint: 'first', role: 'user', text: 'I prefer TypeScript.' }],
		},
	]);
	await restarted.refresh();
	expect(getProvider).toHaveBeenCalledWith('deepseek', 'models');
	expect(generate).toHaveBeenCalledTimes(1);
	expect(generate).toHaveBeenCalledWith(
		expect.objectContaining({
			provider: {
				id: 'deepseek',
				apiKey: 'provider-secret',
				baseURL: 'https://provider.invalid',
			},
			model: 'deepseek-flash',
			options: { temperature: 0 },
			streaming: false,
			tools: [],
			signal: expect.any(AbortSignal),
			messages: [
				{ role: 'system', content: expect.stringContaining('complete MEMORY.md') },
				{ role: 'user', content: expect.stringContaining('Generate the complete MEMORY.md') },
			],
		})
	);
	expect(JSON.stringify(persisted)).not.toContain('provider-secret');
	await restarted.stop();
});
