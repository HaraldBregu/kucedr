const successfulTurn = async function* () {
	yield* [];
	return { content: 'done', model: 'test-model', toolCalls: [] };
};
const runModelTurnMock = jest.fn(successfulTurn);

jest.mock('../../../../../src/main/settings_store', () => ({
	getResolvedProvider: jest.fn(() => ({ id: 'test-provider', apiKey: 'key' })),
}));

jest.mock('../../../../../src/main/agent/runner/run_model_turn', () => ({
	runModelTurn: (...args: unknown[]) => runModelTurnMock(...args),
}));

jest.mock('../../../../../src/main/agent/session/session_append_run', () => ({
	appendRun: jest.fn(),
}));

import {
	AGENT_RUNTIME_TOOL_IDS,
	resetPermissions,
	setToolProfileTool,
} from '../../../../../src/main/agent/agent_store';
import { createSessionState } from '../../../../../src/main/agent/session';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';
import { stream } from '../../../../../src/main/agent/runner/run_stream';
import { respondUserInput } from '../../../../../src/main/agent/user_input/user_input_pending';

const input = {
	runId: 'profile-tool-test',
	task: 'chat',
	message: 'Use the enabled tool.',
	model: 'test-model',
	type: 'default',
	agentId: 'main',
	contextMode: 'minimal',
	interactionMode: 'default',
	toolProfile: 'chat',
} as const;

describe('chat agent tool controls', () => {
	beforeEach(() => {
		runModelTurnMock.mockReset().mockImplementation(successfulTurn);
		resetPermissions('chat');
		for (const toolId of AGENT_RUNTIME_TOOL_IDS) {
			setToolProfileTool('chat', { kind: 'builtin', id: toolId }, { permission: 'deny' });
		}
	});

	it.each(AGENT_RUNTIME_TOOL_IDS)('enables, uses, and disables %s in isolation', async (toolId) => {
		const execute = jest.fn().mockResolvedValue({ used: toolId });
		const args =
			toolId === 'ask'
				? {
						questions: [
							{
								id: 'choice',
								header: 'Choice',
								question: 'Continue?',
								options: [{ label: 'Yes', description: 'Continue.' }],
							},
						],
					}
				: toolId === 'select_screen_source'
					? { sources: [{ id: 'screen:1', name: 'Display 1', type: 'screen' }] }
					: toolId === 'bash'
						? { command: 'true' }
						: {};
		const selectedTool = jsonTool({
			id: toolId,
			name: toolId,
			description: `Test ${toolId}`,
			schema: { type: 'object' },
			planSafe: true,
			capability: { effects: [] },
			execute,
		});
		const runInput = {
			...input,
			...(toolId === 'ask' ? { interactionMode: 'plan' as const } : {}),
			...(['ask', 'select_screen_source'].includes(toolId) ? { approvalWindowId: 7 } : {}),
		};

		setToolProfileTool('chat', { kind: 'builtin', id: toolId }, { permission: 'allow' });
		runModelTurnMock
			.mockImplementationOnce(async function* () {
				yield* [];
				return {
					content: '',
					model: 'test-model',
					toolCalls: [{ id: `call-${toolId}`, name: toolId, args }],
				};
			})
			.mockImplementationOnce(
				toolId === 'ask'
					? async function* () {
							yield* [];
							return {
								content: '<proposed_plan>Continue.</proposed_plan>',
								model: 'test-model',
								toolCalls: [],
							};
						}
					: successfulTurn
			);

		const enabledEvents = [];
		for await (const event of stream(
			{ location: '/workspace' },
			createSessionState(),
			runInput,
			new AbortController().signal,
			{ tools: [selectedTool] }
		)) {
			enabledEvents.push(event);
			if (event.type === 'user_input_request') {
				setTimeout(() => {
					respondUserInput(
						{
							requestId: event.requestId,
							runId: input.runId,
							toolCallId: event.toolCallId,
							inputFingerprint: event.inputFingerprint,
						},
						[
							{
								questionId: toolId === 'ask' ? 'choice' : 'screen-source',
								answer: toolId === 'ask' ? 'Yes' : 'screen:1',
							},
						],
						7
					);
				}, 0);
			}
		}

		expect(enabledEvents[0]).toMatchObject({ type: 'run_started', tools: [toolId] });
		expect((runModelTurnMock.mock.calls[0][5] as Array<{ id: string }>).map((tool) => tool.id)).toEqual([
			toolId,
		]);
		expect(execute).toHaveBeenCalledTimes(['ask', 'select_screen_source'].includes(toolId) ? 0 : 1);
		expect(enabledEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'tool_call_start', toolName: toolId }),
				expect.objectContaining({ type: 'tool_call_end', toolName: toolId }),
			])
		);

		setToolProfileTool('chat', { kind: 'builtin', id: toolId }, { permission: 'deny' });
		runModelTurnMock.mockReset().mockImplementation(successfulTurn);
		const disabledEvents = [];
		for await (const event of stream(
			{ location: '/workspace' },
			createSessionState(),
			runInput,
			new AbortController().signal,
			{ tools: [selectedTool] }
		)) {
			disabledEvents.push(event);
		}

		expect(disabledEvents[0]).toMatchObject({ type: 'run_started', tools: [] });
		expect(runModelTurnMock.mock.calls[0][5]).toEqual([]);
		expect(execute).toHaveBeenCalledTimes(['ask', 'select_screen_source'].includes(toolId) ? 0 : 1);
	});
});
