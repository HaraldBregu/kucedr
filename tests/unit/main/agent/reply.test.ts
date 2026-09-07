import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let location: string;
const mockStream = jest.fn();

jest.mock('../../../../src/main/shared/agent_location', () => ({
	agentLocation: () => location,
}));
jest.mock('../../../../src/main/tasks', () => ({ initTask: jest.fn() }));
jest.mock('../../../../src/main/agent/health', () => ({}));
jest.mock('../../../../src/main/agent/permissions', () => ({}));
jest.mock('../../../../src/main/agent/skills', () =>
	jest.requireActual('../../../../src/main/agent/skills/skills_parse_command')
);
jest.mock('../../../../src/main/agent/agent_store', () => ({
	getProviderId: () => undefined,
	getModelId: () => undefined,
}));
jest.mock('../../../../src/main/agent/runner/run_stream', () => ({
	stream: (...args: unknown[]) => mockStream(...args),
}));

import { Agent } from '../../../../src/main/agent/agent';
import { readGoal } from '../../../../src/main/agent/goal/read';
import { sessionDir } from '../../../../src/main/agent/session';
import type { ExecSandbox } from '../../../../src/main/agent/sandbox';
import type { WindowFactory } from '../../../../src/main/window_factory';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
	location = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-reply-')), 'agent');
	mockStream.mockImplementation(async function* () {});
});

afterEach(() => {
	fs.rmSync(path.dirname(location), { recursive: true, force: true });
});

it.each([
	['Explain this', 'Explain this', undefined],
	['/skill writer Explain this', 'Explain this', 'writer'],
	['/goal Explain this', 'Explain this', undefined],
])('persists reply context and preserves command semantics for %s', async (message, prompt, skill) => {
	const agent = new Agent({} as WindowFactory, {} as ExecSandbox);
	await agent.send(message, 'main', {
		type: 'default',
		sessionId: SESSION_ID,
		replyTo: 'Earlier answer',
	});
	const expected = `> **Replying to Kucedr**\n>\n> Earlier answer\n\n${prompt}`;
	const [, session, input] = mockStream.mock.calls[0];
	expect(input.message).toBe(expected);
	expect(input.explicitSkill).toBe(skill);
	expect(session.messages).toEqual([{ role: 'user', content: expected }]);
	expect(agent.getLastMessages(SESSION_ID)).toEqual([
		expect.objectContaining({ role: 'user', content: expected }),
	]);
	if (message.startsWith('/goal')) {
		expect(readGoal(sessionDir(session))?.objective).toBe('Explain this');
	}
});

it('includes reply context when restoring an active run', async () => {
	const agent = new Agent({} as WindowFactory, {} as ExecSandbox);
	let release: () => void = () => {};
	const pending = new Promise<void>((resolve) => { release = resolve; });
	mockStream.mockImplementation(async function* () { await pending; });
	const response = agent.send('Explain this', 'main', {
		type: 'default',
		runId: 'reply-run',
		sessionId: SESSION_ID,
		replyTo: 'Earlier answer',
	});
	expect(agent.getSessionSnapshot(SESSION_ID).activeRun?.message).toBe(
		'> **Replying to Kucedr**\n>\n> Earlier answer\n\nExplain this'
	);
	release();
	await response;
});
