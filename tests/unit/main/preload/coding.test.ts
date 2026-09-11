const invoke = jest.fn();
const on = jest.fn();
const removeListener = jest.fn();

jest.mock('electron', () => ({
	ipcRenderer: { invoke, on, removeListener },
}));

import { coding } from '../../../../src/preload/coding';
import { CodingChannels } from '../../../../src/shared/ipc_channels_definitions';

beforeEach(() => {
	jest.clearAllMocks();
	invoke.mockResolvedValue({
		success: true,
		data: { projectId: 'project-1', sessionId: 'session-1', output: 'reply' },
	});
});

it('normalizes run requests, filters events, and removes the exact event listener', async () => {
	const callback = jest.fn();
	const request = {
		projectId: ' project-1 ',
		sessionId: ' session-1 ',
		mode: 'agent' as const,
		input: ' inspect ',
	};
	const pending = coding.send(request, callback);

	const runId = invoke.mock.calls[0][2];
	const listener = on.mock.calls[0][1];
	listener(
		{},
		{
			type: 'text-delta',
			runId: 'different-run',
			projectId: 'project-1',
			sessionId: 'session-1',
			delta: 'ignored',
		}
	);
	listener(
		{},
		{
			type: 'text-delta',
			runId,
			projectId: 'project-1',
			sessionId: 'session-1',
			delta: 'kept',
		}
	);
	await expect(pending).resolves.toEqual({
		projectId: 'project-1',
		sessionId: 'session-1',
		output: 'reply',
	});

	expect(invoke).toHaveBeenCalledWith(
		CodingChannels.send,
		{
			projectId: 'project-1',
			sessionId: 'session-1',
			mode: 'agent',
			input: 'inspect',
		},
		expect.any(String)
	);
	expect(on).toHaveBeenCalledWith(CodingChannels.response, expect.any(Function));
	expect(removeListener).toHaveBeenCalledWith(CodingChannels.response, on.mock.calls[0][1]);
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith(expect.objectContaining({ delta: 'kept' }));
	expect(runId).toHaveLength(36);
	expect(() => coding.send({ projectId: 'project-1', mode: 'agent', input: ' ' })).toThrow(
		'Invalid coding run request.'
	);
});

it('normalizes project and session identifiers before forwarding them', async () => {
	await coding.openProject(' project-1 ');
	expect(invoke).toHaveBeenCalledWith(CodingChannels.openProject, 'project-1');

	await coding.listSessions(' project-1 ');
	expect(invoke).toHaveBeenCalledWith(CodingChannels.listSessions, 'project-1');

	await coding.getSession(' project-1 ', ' session-1 ');
	expect(invoke).toHaveBeenCalledWith(CodingChannels.getSession, 'project-1', 'session-1');

	await coding.renameSession(' project-1 ', ' session-1 ', ' Focused tests ');
	expect(invoke).toHaveBeenCalledWith(
		CodingChannels.renameSession,
		'project-1',
		'session-1',
		'Focused tests'
	);

	await coding.deleteSession(' project-1 ', ' session-1 ');
	expect(invoke).toHaveBeenCalledWith(CodingChannels.deleteSession, 'project-1', 'session-1');

	await coding.getProjectInstructions(' project-1 ');
	expect(invoke).toHaveBeenCalledWith(CodingChannels.getProjectInstructions, 'project-1');

	const update = { content: '  keep whitespace\n', expectedRevision: 'revision-1' };
	await coding.saveProjectInstructions(' project-1 ', update);
	expect(invoke).toHaveBeenCalledWith(CodingChannels.saveProjectInstructions, 'project-1', update);

	expect(() => coding.removeProject(' ')).toThrow('Invalid coding project id.');
	expect(() => coding.getSession('project-1', ' ')).toThrow('Invalid coding session.');
	expect(() => coding.renameSession('project-1', 'session-1', ' ')).toThrow(
		'Invalid coding session title.'
	);
	expect(() =>
		coding.saveProjectInstructions('project-1', { content: 'content', expectedRevision: '' })
	).toThrow('Invalid coding project instructions.');
});

it('validates settings before forwarding them to main', () => {
	expect(() =>
		coding.saveSettings({
			runtime: 'pi',
			providerId: 'unsupported',
			modelId: 'model',
			thinkingLevel: 'medium',
			toolMode: 'read-only',
		} as never)
	).toThrow('Invalid coding settings.');
});
