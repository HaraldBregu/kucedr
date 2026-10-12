const mockRunModelTurn = jest.fn();

jest.mock('../../../src/main/settings_store', () => ({
	getResolvedProvider: jest.fn(() => ({ id: 'test-provider', apiKey: 'key' })),
}));
jest.mock('../../../src/main/agent/runner/run_model_turn', () => ({
	runModelTurn: (...args: unknown[]) => mockRunModelTurn(...args),
}));

import { createSessionState } from '../../../src/main/agent/session';
import { stream } from '../../../src/main/agent/runner/run_stream';
import { jsonTool } from '../../../src/main/agent/tools/tool';

it('debug camera recorder', async () => {
	const recorder = jsonTool({
		id: 'camera_recorder',
		category: 'system',
		name: 'camera_recorder',
		description: 'camera_recorder',
		capability: { effects: ['sensor', 'write'] },
		schema: { type: 'object' },
		execute: () => ({ id: 'recording-1', status: 'recording' }),
	});
	mockRunModelTurn
		.mockImplementationOnce(async function* () {
			yield* [];
			return {
				content: '',
				model: 'test-model',
				toolCalls: [{ id: 'record', name: 'camera_recorder', args: {} }],
			};
		})
		.mockImplementationOnce(async function* () {
			yield* [];
			return { content: 'done', model: 'test-model', toolCalls: [] };
		});
	const events = [];
	for await (const event of stream(
		{ location: '/workspace' },
		createSessionState(),
		{
			runId: 'camera-run',
			task: 'chat',
			message: 'Start recording',
			model: 'test-model',
			type: 'default',
			agentId: 'main',
			contextMode: 'minimal',
		},
		new AbortController().signal,
		{ tools: [recorder] }
	))
		events.push(event);

	console.log(
		'EVENTS',
		JSON.stringify(
			events.map((e) => ({
				type: e.type,
				...('toolName' in e ? { toolName: e.toolName } : {}),
				...('output' in e ? { output: e.output } : {}),
				...('isError' in e ? { isError: e.isError } : {}),
			})),
			null,
			1
		)
	);
	console.log('TURNS', mockRunModelTurn.mock.calls.length);
});
