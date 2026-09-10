const invoke = jest.fn();
const on = jest.fn();
const removeListener = jest.fn();

jest.mock('electron', () => ({
	ipcRenderer: { invoke, on, removeListener },
}));

import { agent } from '../../../../src/preload/agent';
import { AgentChannels } from '../../../../src/shared/ipc_channels_definitions';

beforeEach(() => {
	invoke.mockResolvedValue({ success: true, data: 'response' });
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
