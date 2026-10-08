const getMcpServers = jest.fn();
const getMcpOauth = jest.fn();
const runModelTurnMock = jest.fn();

jest.mock('../../../../../src/main/mcp', () => ({
	getMcpServers: () => getMcpServers(),
	getMcpOauth: (id: string) => getMcpOauth(id),
}));
jest.mock('../../../../../src/main/mcp/manifest', () => ({ findMcpService: () => undefined }));
jest.mock('../../../../../src/main/settings_store', () => ({
	getResolvedProvider: () => ({ id: 'test-provider', apiKey: 'key' }),
}));
jest.mock('../../../../../src/main/agent/runner/run_model_turn', () => ({
	runModelTurn: (...args: unknown[]) => runModelTurnMock(...args),
}));

import { stream } from '../../../../../src/main/agent/runner/run_stream';
import { createSessionState } from '../../../../../src/main/agent/session';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';
import { respondUserInput } from '../../../../../src/main/agent/user_input/user_input_pending';
import type { RuntimeEvent } from '../../../../../src/main/agent/types';

const runMcp = jest.fn();
const mcp = jsonTool({
	id: 'mcp__gmail__lookup',
	name: 'Lookup',
	description: 'Lookup Gmail',
	policy: { kind: 'mcp', serverId: 'gmail', toolName: 'lookup' },
	capability: { effects: ['read'] },
	schema: { type: 'object' },
	execute: runMcp,
});

beforeEach(() => {
	getMcpServers.mockReturnValue({ gmail: { type: 'http', url: 'https://mcp.example', name: 'Gmail' } });
	getMcpOauth.mockReturnValue({});
	runMcp.mockReset();
	runModelTurnMock.mockReset();
});

it('shows the failed MCP call, waits for authorization, then retries the same arguments once', async () => {
	runMcp
		.mockResolvedValueOnce({ status: 'authorization_required', serverId: 'gmail', serverName: 'Gmail' })
		.mockResolvedValueOnce('message found');
	runModelTurnMock
		.mockImplementationOnce(async function* () {
			yield* [];
			return {
				content: '',
				model: 'test-model',
				toolCalls: [{ id: 'original', name: mcp.id, args: { query: 'subject' } }],
			};
		})
		.mockImplementationOnce(async function* () {
			yield* [];
			return { content: 'Found it.', model: 'test-model', toolCalls: [] };
		});
	const session = createSessionState();
	session.messages = [{ role: 'user', content: 'Find the email' }];
	const events: RuntimeEvent[] = [];
	const iterator = stream(
		{ location: '/workspace' }, session,
		{
			runId: 'run', task: 'chat', message: 'Find the email', model: 'test-model',
			type: 'default', agentId: 'main', contextMode: 'minimal',
			interactionMode: 'default', approvalWindowId: 7,
		},
		new AbortController().signal,
		{ tools: [mcp] }
	);
	let request: Extract<RuntimeEvent, { type: 'user_input_request' }> | undefined;
	while (!request) {
		const next = await iterator.next();
		if (next.done) throw new Error('Expected authorization request');
		events.push(next.value);
		if (next.value.type === 'user_input_request') request = next.value;
	}
	expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(['tool_call_end', 'user_input_request']));
	expect(events.findIndex((event) => event.type === 'tool_call_end')).toBeLessThan(events.findIndex((event) => event.type === 'user_input_request'));
	expect(runMcp).toHaveBeenCalledTimes(1);
	const next = iterator.next();
	await Promise.resolve();
	getMcpOauth.mockReturnValue({ tokens: { access_token: 'token' } });
	expect(respondUserInput({
		requestId: request.requestId, runId: 'run', toolCallId: request.toolCallId,
		inputFingerprint: request.inputFingerprint,
	}, [{ questionId: 'mcp-authorization', answer: 'authorized' }], 7)).toBe(true);
	const resumed = await next;
	if (!resumed.done) events.push(resumed.value);
	for await (const event of iterator) events.push(event);
	expect(runMcp).toHaveBeenCalledTimes(2);
	expect(runMcp).toHaveBeenNthCalledWith(2, { query: 'subject' }, expect.any(AbortSignal));
	expect(session.toolCalls.map((call) => call.name)).toEqual([
		mcp.id, 'request_mcp_authorization', mcp.id,
	]);
	expect(session.messages.filter((message) => message.role === 'assistant').slice(0, 3)
		.map((message) => message.toolCalls?.map((call) => call.name))).toEqual([
		[mcp.id], ['request_mcp_authorization'], [mcp.id],
	]);
	expect(session.toolCalls[0].result?.isError).toBe(true);
	expect(session.toolCalls[2].result?.content).toBe('message found');
	expect(events.at(-1)).toMatchObject({ type: 'run_finished', result: { text: 'Found it.' } });
});

it('stops after cancellation without retrying the failed MCP call', async () => {
	runMcp.mockResolvedValue({ status: 'authorization_required', serverId: 'gmail', serverName: 'Gmail' });
	runModelTurnMock.mockImplementationOnce(async function* () {
		yield* [];
		return {
			content: '', model: 'test-model',
			toolCalls: [{ id: 'original', name: mcp.id, args: { query: 'subject' } }],
		};
	});
	const session = createSessionState();
	session.messages = [{ role: 'user', content: 'Find the email' }];
	const iterator = stream(
		{ location: '/workspace' }, session,
		{
			runId: 'run', task: 'chat', message: 'Find the email', model: 'test-model',
			type: 'default', agentId: 'main', contextMode: 'minimal',
			interactionMode: 'default', approvalWindowId: 7,
		},
		new AbortController().signal,
		{ tools: [mcp] }
	);
	let request: Extract<RuntimeEvent, { type: 'user_input_request' }> | undefined;
	while (!request) {
		const next = await iterator.next();
		if (next.done) throw new Error('Expected authorization request');
		if (next.value.type === 'user_input_request') request = next.value;
	}
	const next = iterator.next();
	await Promise.resolve();
	expect(respondUserInput({
		requestId: request.requestId, runId: 'run', toolCallId: request.toolCallId,
		inputFingerprint: request.inputFingerprint,
	}, [{ questionId: 'mcp-authorization', answer: 'cancel' }], 7)).toBe(true);
	const events: RuntimeEvent[] = [];
	const resumed = await next;
	if (!resumed.done) events.push(resumed.value);
	for await (const event of iterator) events.push(event);
	expect(runMcp).toHaveBeenCalledTimes(1);
	expect(runModelTurnMock).toHaveBeenCalledTimes(1);
	expect(session.toolCalls.map((call) => call.name)).toEqual([mcp.id, 'request_mcp_authorization']);
	expect(events.at(-1)).toMatchObject({ type: 'run_finished', result: { stopReason: 'cancelled' } });
});
