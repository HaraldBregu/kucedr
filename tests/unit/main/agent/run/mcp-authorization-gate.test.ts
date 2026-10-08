const getMcpOauth = jest.fn();

jest.mock('../../../../../src/main/mcp', () => ({
	getMcpOauth: (id: string) => getMcpOauth(id),
}));

import { runToolCalls } from '../../../../../src/main/agent/runner/run_tool_calls';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';
import { respondUserInput } from '../../../../../src/main/agent/user_input/user_input_pending';
import type { RuntimeEvent, ToolCall } from '../../../../../src/main/agent/types';

const authorization = jsonTool({
	id: 'request_mcp_authorization',
	name: 'Authorize',
	description: 'Authorize MCP',
	schema: { type: 'object' },
	execute: () => ({ status: 'authorization_required', serverId: 'gmail', serverName: 'Gmail' }),
});
const nextRun = jest.fn(() => 'ran');
const nextTool = jsonTool({
	id: 'next_tool',
	name: 'Next',
	description: 'Next tool',
	schema: { type: 'object' },
	execute: nextRun,
});

beforeEach(() => {
	getMcpOauth.mockReset();
	getMcpOauth.mockReturnValue({});
	nextRun.mockClear();
});

it.each([
	['cancel', false],
	['authorized', true],
])('holds the tool batch until %s and only proceeds when authorized', async (answer, proceed) => {
	const calls: ToolCall[] = [
		{ id: 'authorization', name: 'request_mcp_authorization', args: { serverId: 'gmail' } },
		{ id: 'next', name: 'next_tool', args: {} },
	];
	const events = runToolCalls(
		[authorization, nextTool],
		calls,
		new AbortController().signal,
		undefined,
		{ runId: 'run', windowId: 7, interactionMode: 'default' }
	);
	expect((await events.next()).value).toMatchObject({ type: 'tool_call_start' });
	const request = (await events.next()).value as Extract<
		RuntimeEvent,
		{ type: 'user_input_request' }
	>;
	expect(request).toMatchObject({ type: 'user_input_request', toolCallId: 'authorization' });
	expect(nextRun).not.toHaveBeenCalled();
	const resumed = events.next();
	await Promise.resolve();
	if (proceed) getMcpOauth.mockReturnValue({ tokens: { access_token: 'token' } });
	expect(
		respondUserInput(
			{
				requestId: request.requestId,
				runId: 'run',
				toolCallId: 'authorization',
				inputFingerprint: request.inputFingerprint,
			},
			[{ questionId: 'mcp-authorization', answer }],
			7
		)
	).toBe(true);
	await resumed;
	for await (const _event of events) void _event;
	expect(JSON.parse(calls[0].result?.content as string)).toMatchObject({
		status: proceed ? 'authorized' : 'cancelled',
	});
	expect(Boolean(calls[1].result)).toBe(proceed);
});
