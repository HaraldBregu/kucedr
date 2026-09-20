const mockRunModelTurn = jest.fn(async function* () {
	yield* [];
	return { content: 'done', model: 'test-model', toolCalls: [] };
});

jest.mock('../../../../../src/main/settings_store', () => ({
	getResolvedProvider: jest.fn(() => ({ id: 'test-provider', apiKey: 'key' })),
}));
jest.mock('../../../../../src/main/agent/agent_store', () => ({
	getModelId: jest.fn(() => 'test-model'),
	getModelOptions: jest.fn(() => ({})),
	getProviderId: jest.fn(() => 'test-provider'),
	getPermissions: jest.fn(() => ({ tools: {} })),
}));
jest.mock('../../../../../src/main/agent/runner/run_model_turn', () => ({
	runModelTurn: (...args: unknown[]) => mockRunModelTurn(...args),
}));
jest.mock('../../../../../src/main/agent/skills', () => ({
	createSkillRegistrySnapshot: jest.fn(() => ({ skills: [], diagnostics: [] })),
}));

import { createSessionState } from '../../../../../src/main/agent/session';
import { stream } from '../../../../../src/main/agent/runner/run_stream';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';

it('distinguishes an omitted background allowlist from an explicit empty allowlist', async () => {
	const tools = ['read', 'bash'].map((id) =>
		jsonTool({
			id,
			name: id,
			description: id,
			schema: { type: 'object' },
			execute: jest.fn(),
		})
	);
	const run = async (toolsAllow?: string[]): Promise<string[]> => {
		const events = [];
		for await (const event of stream(
			{ location: '/workspace' },
			createSessionState(),
			{
				runId: 'background-run',
				task: 'chat',
				message: 'Do the work',
				agentId: 'tasks',
				type: 'background',
				contextMode: 'minimal',
				...(toolsAllow === undefined ? {} : { toolsAllow }),
			},
			new AbortController().signal,
			{ tools }
		))
			events.push(event);
		const started = events.find((event) => event.type === 'run_started');
		if (!started || started.type !== 'run_started') throw new Error('Run did not start.');
		return started.tools;
	};

	await expect(run()).resolves.toEqual(['discover_tools']);
	await expect(run([])).resolves.toEqual(['discover_tools']);
	await expect(run(['read'])).resolves.toEqual(['discover_tools']);
});
