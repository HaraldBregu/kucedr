const invoke = jest.fn();
const on = jest.fn();
const removeListener = jest.fn();

jest.mock('electron', () => ({
	ipcRenderer: { invoke, on, removeListener },
}));

import { agent } from '../../../../src/preload/agent';
import { AgentChannels } from '../../../../src/shared/ipc_channels_definitions';

beforeEach(() => {
	invoke.mockReset();
	on.mockReset();
	removeListener.mockReset();
	invoke.mockResolvedValue({ success: true, data: { text: 'response' } });
});

it('forwards the terminal event from the result when invoke finishes before streamed delivery', async () => {
	const finished = { type: 'run_finished', agentId: 'main', runId: 'reply-run', stopReason: 'end_turn', outputChars: 5 };
	const callback = jest.fn();
	invoke.mockResolvedValue({ success: true, data: { text: 'reply', finished } });
	await expect(agent.send('Hello', { runId: 'reply-run' }, callback)).resolves.toBe('reply');
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith(finished);
	expect(removeListener).toHaveBeenCalledWith(AgentChannels.response, on.mock.calls[0][1]);
	on.mock.calls[0][1]({}, finished);
	expect(callback).toHaveBeenCalledTimes(1);
});

it('delivers a streamed terminal event once even when it is also included in the invoke result', async () => {
	const finished = { type: 'run_finished', agentId: 'main', runId: 'reply-run', stopReason: 'end_turn', outputChars: 5 };
	const callback = jest.fn();
	invoke.mockImplementation(async () => {
		const listener = on.mock.calls[0][1];
		listener({}, { ...finished, runId: 'unrelated-run' });
		listener({}, finished);
		listener({}, finished);
		return { success: true, data: { text: 'reply', finished } };
	});
	await expect(agent.send('Hello', { runId: 'reply-run' }, callback)).resolves.toBe('reply');
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith(finished);
});

it.each(['cancelled', 'timeout', 'error'])('preserves a %s terminal result with partial text', async (stopReason) => {
	const finished = { type: 'run_finished', agentId: 'main', runId: 'reply-run', stopReason, outputChars: 7 };
	const callback = jest.fn();
	invoke.mockResolvedValue({ success: true, data: { text: 'partial', finished } });
	await expect(agent.send('Hello', { runId: 'reply-run' }, callback)).resolves.toBe('partial');
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith(finished);
});

it('resolves a queued cancellation without waiting for an event that was never emitted', async () => {
	const callback = jest.fn();
	invoke.mockResolvedValue({ success: true, data: { text: '' } });
	await expect(agent.send('Hello', { runId: 'queued-run' }, callback)).resolves.toBe('');
	expect(callback).not.toHaveBeenCalled();
	expect(removeListener).toHaveBeenCalledTimes(1);
});

it('removes the event listener when the invoke fails without fabricating a completion', async () => {
	const callback = jest.fn();
	invoke.mockResolvedValue({ success: false, error: { message: 'Request failed' } });
	await expect(agent.send('Hello', { runId: 'failed-run' }, callback)).rejects.toThrow('Request failed');
	expect(callback).not.toHaveBeenCalled();
	expect(removeListener).toHaveBeenCalledTimes(1);
});

it('forwards trimmed reply context without modifying slash commands', async () => {
	await agent.send('/skill writer Expand this', {
		runId: 'reply-run',
		replyTo: '  Earlier assistant message\nwith details  ',
	});
	expect(invoke).toHaveBeenCalledWith(AgentChannels.send, '/skill writer Expand this', {
		runId: 'reply-run',
		interactionMode: 'default',
		replyTo: 'Earlier assistant message\nwith details',
	});
});

it('omits empty reply context', async () => {
	await agent.send('Hello', { runId: 'plain-run', replyTo: ' \n ' });
	expect(invoke).toHaveBeenCalledWith(AgentChannels.send, 'Hello', {
		runId: 'plain-run',
		interactionMode: 'default',
	});
});

it('opens the chat history folder through the dedicated agent channel', async () => {
	await agent.openSessionsFolder();
	expect(invoke).toHaveBeenCalledWith(AgentChannels.openSessionsFolder);
});

it('opens a specific session folder through the dedicated agent channel', async () => {
	await agent.openSessionFolder(' session-1 ');
	expect(invoke).toHaveBeenCalledWith(AgentChannels.openSessionFolder, 'session-1');
});

it('reveals a Workspace entry through its dedicated channel', async () => {
	await agent.revealWorkspaceEntry(' Notes/plan.md ');
	expect(invoke).toHaveBeenCalledWith(AgentChannels.revealWorkspaceEntry, 'Notes/plan.md');
	expect(() => agent.revealWorkspaceEntry(' ')).toThrow('Invalid workspace entry path.');
});

it('validates and forwards a compact-session request', async () => {
	await agent.compactSession(' session-1 ');
	expect(invoke).toHaveBeenCalledWith(AgentChannels.compactSession, 'session-1');
	expect(() => agent.compactSession(' ')).toThrow('Invalid assistant session id.');
});

it('queries and cancels background Knowledge indexing through typed channels', async () => {
	await agent.ragGetStatus();
	await agent.ragCancelIndex();
	expect(invoke).toHaveBeenCalledWith(AgentChannels.ragGetStatus);
	expect(invoke).toHaveBeenCalledWith(AgentChannels.ragCancelIndex);
});
