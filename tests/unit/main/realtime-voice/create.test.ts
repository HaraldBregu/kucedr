const mockRead = {
	id: 'read',
	name: 'Read',
	description: 'Read a file',
	schema: { type: 'object' },
	timeoutMs: 1_000,
	maxOutputBytes: 1_000,
	capability: { effects: ['read'] },
	parseInput: (input: unknown) => input as Record<string, unknown>,
	run: () => 'read',
};
const mockWrite = {
	...mockRead,
	id: 'write',
	name: 'Write',
	description: 'Write a file',
	capability: { effects: ['write'] },
	run: () => 'write',
};

jest.mock('../../../../src/main/agent/runner/run_builtin_tools', () => ({
	builtinTools: () => [mockRead, mockWrite],
}));
jest.mock('../../../../src/main/agent/system', () => ({
	buildSystemPrompt: async (_config: unknown, tools: Array<{ id: string }>) =>
		`System tools: ${tools.map((tool) => tool.id).join(', ')}`,
	buildWorkspaceContext: async () => '',
}));
jest.mock('../../../../src/main/agent/agent_store', () => ({
	getPermissions: () => ({ tools: {} }),
	getToolConfiguration: () => ({ enabled: true, permission: 'allow' }),
}));
jest.mock('../../../../src/main/settings_store', () => ({
	getProvider: () => ({ id: 'openai', name: 'OpenAI', apiKey: 'key' }),
}));
jest.mock('../../../../src/main/models', () => ({
	defaultProviderId: () => 'openai',
	loadModels: () => [
		{
			id: 'gpt-realtime-2.1',
			type: 'realtime-voice',
			default: true,
			provider: { id: 'openai', name: 'OpenAI' },
			metadata: { inputs: { voice: { enum: ['marin'], default: 'marin' } } },
		},
	],
}));
jest.mock('../../../../src/main/models/selection', () => ({
	getProviderId: () => 'openai',
	getModelId: () => 'gpt-realtime-2.1',
	getOptions: () => ({}),
}));
jest.mock('../../../../src/main/models/adapters/realtime_voice', () => ({
	buildRealtimeVoiceAdapter: jest.fn(),
	realtimeVoiceDefaultVoice: () => 'marin',
	supportsRealtimeVoiceModel: () => true,
	supportsRealtimeVoiceTools: () => true,
}));
jest.mock('../../../../src/main/apps/app_render', () => ({ openAppWindows: new Map() }));

import { createRealtimeVoiceManager } from '../../../../src/main/agent/realtime_voice/create';
import type { Agent } from '../../../../src/main/agent/agent';
import type { ResolvedRealtimeVoiceConfiguration } from '../../../../src/main/agent/realtime_voice/manager';

it('starts voice with every eligible built-in tool', async () => {
	const manager = createRealtimeVoiceManager(
		{
			config: { location: '/workspace' },
			sandbox: {},
			resources: {},
			sessions: {},
		} as Agent,
		{ sendTo: jest.fn() } as never
	);
	const dependencies = (
		manager as unknown as {
			dependencies: { resolveConfiguration(): Promise<ResolvedRealtimeVoiceConfiguration> };
		}
	).dependencies;
	const configuration = await dependencies.resolveConfiguration();

	expect(configuration.tools.map((tool) => tool.id)).toEqual(['read', 'write']);
	expect(configuration.instructions).toContain('read, write');
});
