const mockDiscover = jest.fn();
const mockCreateFromAgentCard = jest.fn();
const mockClientFactory = jest.fn();
const mockJsonRpcTransportFactory = jest.fn();
const mockRestTransportFactory = jest.fn();

jest.mock('../../../../src/main/agent/a2a/discover', () => ({ discoverA2aAgent: mockDiscover }));
jest.mock('@a2a-js/sdk/client', () => ({
	ClientFactory: mockClientFactory,
	JsonRpcTransportFactory: mockJsonRpcTransportFactory,
	RestTransportFactory: mockRestTransportFactory,
}));
jest.mock('@a2a-js/sdk', () => ({
	Role: { ROLE_USER: 1 },
	TaskState: {
		TASK_STATE_UNSPECIFIED: 0,
		TASK_STATE_SUBMITTED: 1,
		TASK_STATE_WORKING: 2,
		TASK_STATE_COMPLETED: 3,
		TASK_STATE_FAILED: 4,
		TASK_STATE_CANCELED: 5,
		TASK_STATE_INPUT_REQUIRED: 6,
		TASK_STATE_REJECTED: 7,
		TASK_STATE_AUTH_REQUIRED: 8,
	},
	taskStateToJSON: (state: number) =>
		[
			'TASK_STATE_UNSPECIFIED',
			'TASK_STATE_SUBMITTED',
			'TASK_STATE_WORKING',
			'TASK_STATE_COMPLETED',
			'TASK_STATE_FAILED',
			'TASK_STATE_CANCELED',
			'TASK_STATE_INPUT_REQUIRED',
			'TASK_STATE_REJECTED',
			'TASK_STATE_AUTH_REQUIRED',
		][state] ?? 'UNRECOGNIZED',
}));

import { TaskState } from '@a2a-js/sdk';
import { sendA2aMessage } from '../../../../src/main/agent/a2a/send';
import { setA2aAgents } from '../../../../src/main/agent/a2a/store';

const card = {
	name: 'Remote',
	description: 'Remote',
	supportedInterfaces: [
		{
			url: 'https://remote.example/a2a',
			protocolBinding: 'JSONRPC',
			protocolVersion: '1.0',
			tenant: '',
		},
	],
	capabilities: { streaming: false, extensions: [] },
	securitySchemes: {},
	securityRequirements: [],
	defaultInputModes: ['text/plain'],
	defaultOutputModes: ['text/plain'],
	skills: [],
};

beforeEach(() => {
	jest.clearAllMocks();
	setA2aAgents([
		{
			id: 'target',
			name: 'Remote',
			url: 'https://remote.example',
			authType: 'bearer',
			credential: 'secret',
			enabled: true,
			skills: [],
		},
	]);
	mockDiscover.mockResolvedValue(card);
	mockClientFactory.mockImplementation(() => ({ createFromAgentCard: mockCreateFromAgentCard }));
	mockJsonRpcTransportFactory.mockImplementation(() => ({}));
	mockRestTransportFactory.mockImplementation(() => ({}));
});

it('prioritizes an exact ID and forwards continuation IDs, credentials, and cancellation', async () => {
	setA2aAgents([
		{
			id: 'first',
			name: 'target',
			url: 'https://wrong.example',
			authType: 'none',
			enabled: true,
			skills: [],
		},
		{
			id: 'target',
			name: 'Right',
			url: 'https://right.example',
			authType: 'bearer',
			credential: 'secret',
			enabled: true,
			skills: [],
		},
	]);
	mockDiscover.mockResolvedValue({
		...card,
		supportedInterfaces: [{ ...card.supportedInterfaces[0], url: 'https://right.example/a2a' }],
	});
	const sendMessage = jest
		.fn()
		.mockResolvedValue({ parts: [{ content: { $case: 'text', value: 'done' } }] });
	mockCreateFromAgentCard.mockResolvedValue({ sendMessage });
	const controller = new AbortController();

	await expect(
		sendA2aMessage('target', 'continue', controller.signal, 'task-1', 'context-1')
	).resolves.toBe('done');
	expect(mockDiscover).toHaveBeenCalledWith(
		'https://right.example',
		expect.objectContaining({ authType: 'bearer', credential: 'secret' }),
		expect.any(AbortSignal)
	);
	expect(sendMessage).toHaveBeenCalledWith(
		expect.objectContaining({
			message: expect.objectContaining({ taskId: 'task-1', contextId: 'context-1', role: 1 }),
		}),
			expect.objectContaining({ signal: controller.signal })
		);
});

it('returns artifacts from a completed initial Task-only stream', async () => {
	mockDiscover.mockResolvedValue({ ...card, capabilities: { streaming: true, extensions: [] } });
	const sendMessageStream = jest.fn(async function* () {
		yield {
			payload: {
				$case: 'task',
				value: {
					id: 'task-1',
					contextId: 'context-1',
					status: { state: TaskState.TASK_STATE_COMPLETED },
					artifacts: [
						{ artifactId: 'answer', parts: [{ content: { $case: 'text', value: 'complete' } }] },
					],
				},
			},
		};
	});
	mockCreateFromAgentCard.mockResolvedValue({ sendMessageStream });

	await expect(sendA2aMessage('target', 'work')).resolves.toBe('complete');
});

it('honors artifact replacement and append semantics', async () => {
	mockDiscover.mockResolvedValue({ ...card, capabilities: { streaming: true, extensions: [] } });
	const sendMessageStream = jest.fn(async function* () {
		yield {
			payload: {
				$case: 'artifactUpdate',
				value: {
					taskId: 'task-1',
					contextId: 'context-1',
					append: false,
					artifact: {
						artifactId: 'answer',
						parts: [{ content: { $case: 'text', value: 'wrong' } }],
					},
				},
			},
		};
		yield {
			payload: {
				$case: 'artifactUpdate',
				value: {
					taskId: 'task-1',
					contextId: 'context-1',
					append: false,
					artifact: { artifactId: 'answer', parts: [{ content: { $case: 'text', value: 'Hel' } }] },
				},
			},
		};
		yield {
			payload: {
				$case: 'artifactUpdate',
				value: {
					taskId: 'task-1',
					contextId: 'context-1',
					append: true,
					artifact: { artifactId: 'answer', parts: [{ content: { $case: 'text', value: 'lo' } }] },
				},
			},
		};
		yield {
			payload: {
				$case: 'statusUpdate',
				value: {
					taskId: 'task-1',
					contextId: 'context-1',
					status: { state: TaskState.TASK_STATE_COMPLETED },
				},
			},
		};
	});
	mockCreateFromAgentCard.mockResolvedValue({ sendMessageStream });

	await expect(sendA2aMessage('target', 'work')).resolves.toBe('Hello');
});

it('redacts configured credentials from streamed terminal errors', async () => {
	mockDiscover.mockResolvedValue({ ...card, capabilities: { streaming: true, extensions: [] } });
	const sendMessageStream = jest.fn(async function* () {
		yield {
			payload: {
				$case: 'statusUpdate',
				value: {
					taskId: 'task-1',
					contextId: 'ctx',
					status: {
						state: TaskState.TASK_STATE_FAILED,
						message: {
							parts: [{ content: { $case: 'text', value: 'credential secret rejected' } }],
						},
					},
				},
			},
		};
	});
	mockCreateFromAgentCard.mockResolvedValue({ sendMessageStream });

	await expect(sendA2aMessage('target', 'work')).rejects.toThrow(
		'Remote task task-1 (context ctx) is failed: credential [REDACTED] rejected'
	);
});

it('turns terminal failures into tool errors and preserves interrupted task references', async () => {
	const sendMessage = jest
		.fn()
		.mockResolvedValueOnce({
			id: 'failed',
			contextId: 'ctx',
			status: {
				state: TaskState.TASK_STATE_FAILED,
				message: { parts: [{ content: { $case: 'text', value: 'boom' } }] },
			},
			artifacts: [],
		})
		.mockResolvedValueOnce({
			id: 'input',
			contextId: 'ctx',
			status: {
				state: TaskState.TASK_STATE_INPUT_REQUIRED,
				message: { parts: [{ content: { $case: 'text', value: 'Which city?' } }] },
			},
			artifacts: [],
		});
	mockCreateFromAgentCard.mockResolvedValue({ sendMessage });

	await expect(sendA2aMessage('target', 'work')).rejects.toThrow(
		'Remote task failed (context ctx) is failed: boom'
	);
	await expect(sendA2aMessage('target', 'work')).resolves.toBe(
		'Remote task input (context ctx) requires input: Which city?'
	);
});

it('uses readable state fallback text instead of numeric enum values', async () => {
	const sendMessage = jest.fn().mockResolvedValue({
		id: 'task-1',
		contextId: 'ctx',
		status: { state: TaskState.TASK_STATE_COMPLETED },
		artifacts: [],
	});
	mockCreateFromAgentCard.mockResolvedValue({ sendMessage });
	await expect(sendA2aMessage('target', 'work')).resolves.toBe(
		'Remote task task-1 (context ctx) is completed.'
	);
});

it('preserves task references for non-terminal task output', async () => {
	const sendMessage = jest.fn().mockResolvedValue({
		id: 'task-1',
		contextId: 'ctx',
		status: { state: TaskState.TASK_STATE_WORKING },
		artifacts: [
			{ artifactId: 'answer', parts: [{ content: { $case: 'text', value: 'partial' } }] },
		],
	});
	mockCreateFromAgentCard.mockResolvedValue({ sendMessage });
	await expect(sendA2aMessage('target', 'work')).resolves.toBe(
		'Remote task task-1 (context ctx) is working: partial'
	);
});

it('rejects oversized non-stream responses', async () => {
	const sendMessage = jest.fn().mockResolvedValue({
		parts: [{ content: { $case: 'text', value: 'x'.repeat(200_001) } }],
	});
	mockCreateFromAgentCard.mockResolvedValue({ sendMessage });
	await expect(sendA2aMessage('target', 'work')).rejects.toThrow('200 KB limit');
});

it('requests remote cancellation after an aborted task stream', async () => {
	mockDiscover.mockResolvedValue({ ...card, capabilities: { streaming: true, extensions: [] } });
	const controller = new AbortController();
	const sendMessageStream = jest.fn(async function* () {
		yield {
			payload: {
				$case: 'task',
				value: {
					id: 'task-1',
					contextId: 'ctx',
					status: { state: TaskState.TASK_STATE_WORKING },
					artifacts: [],
				},
			},
		};
		controller.abort();
		throw controller.signal.reason;
	});
	const cancelTask = jest.fn().mockResolvedValue({});
	mockCreateFromAgentCard.mockResolvedValue({ sendMessageStream, cancelTask });

	await expect(sendA2aMessage('target', 'work', controller.signal)).rejects.toMatchObject({
		name: 'AbortError',
	});
	expect(cancelTask).toHaveBeenCalledWith(
		{ tenant: '', id: 'task-1', metadata: undefined },
		{ signal: expect.any(AbortSignal) }
	);
});
