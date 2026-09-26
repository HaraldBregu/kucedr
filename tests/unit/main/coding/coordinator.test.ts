import { mkdtempSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

jest.mock('../../../../src/main/coding/pi', () => ({
	Pi: jest
		.fn()
		.mockImplementation(() => ({
			listSessions: async () => [],
			destroy: jest.fn(),
			cancelCodexLogin: jest.fn(),
		})),
}));
jest.mock('../../../../src/main/coding/harness/codex', () => ({ CodexHarness: jest.fn() }));
jest.mock('../../../../src/main/coding/harness/claude', () => ({ ClaudeHarness: jest.fn() }));

import { Coding } from '../../../../src/main/coding/coding';
import { CoderSessions } from '../../../../src/main/coding/sessions';
import type { CodingSettings, CodingResponseEvent } from '../../../../src/shared/coding_types';
import type { HarnessContext } from '../../../../src/main/coding/harness/types';
import type { CodingProjectStore } from '../../../../src/main/coding/projects';
import type { CodingStore } from '../../../../src/main/coding/store';

const settings: CodingSettings = {
	runtime: 'codex',
	providerId: 'openai-codex',
	modelId: 'model-a',
	thinkingLevel: 'medium',
	toolMode: 'coding',
};

function fixture(run: (input: string, context: HarnessContext) => Promise<string>) {
	const directory = mkdtempSync(path.join(os.tmpdir(), 'coder-coordinator-'));
	const projectDirectory = path.join(directory, 'project');
	mkdirSync(projectDirectory);
	const project = {
		id: 'project',
		name: 'Project',
		directory: projectDirectory,
		available: true,
		kind: 'external' as const,
		createdAt: '',
		lastOpenedAt: '',
	};
	const store = { get: jest.fn(() => settings), set: jest.fn() };
	const projects = {
		get: jest.fn((id: string) => (id === 'project' ? project : undefined)),
		list: () => [project],
		add: jest.fn(() => project),
		touch: jest.fn(),
	};
	const sessions = new CoderSessions(path.join(directory, 'coder', 'sessions', 'records'));
	const coding = new Coding({
		store: store as unknown as CodingStore,
		projects: projects as unknown as CodingProjectStore,
		getProvider: () => undefined,
		credentials: { get: () => undefined, set: jest.fn() },
		sessions,
		harnesses: { codex: { run, listModels: async () => ({ providers: [] }) } },
	});
	return { coding, sessions, store, project, directory };
}

it('pins harness, model and directory across restarts and persists tools with native session identity', async () => {
	const contexts: HarnessContext[] = [];
	const f = fixture(async (_, context) => {
		contexts.push(context);
		await context.saveSession('native-thread');
		context.emit({ type: 'text-delta', delta: 'Before' });
		context.emit({ type: 'tool-start', toolCallId: 'read', toolName: 'Read' });
		context.emit({ type: 'tool-end', toolCallId: 'read', toolName: 'Read', isError: false });
		context.emit({ type: 'text-delta', delta: 'After' });
		return 'BeforeAfter';
	});
	const first = await f.coding.send(
		1,
		'run-a',
		{ projectId: 'project', mode: 'agent', input: 'Inspect' },
		() => {}
	);
	f.store.get.mockReturnValue({
		...settings,
		runtime: 'claude',
		providerId: 'anthropic',
		modelId: 'different',
	});
	await f.coding.send(
		1,
		'run-b',
		{ projectId: 'project', sessionId: first.sessionId, mode: 'agent', input: 'Continue' },
		() => {}
	);
	expect(contexts[1]).toMatchObject({
		cwd: f.project.directory,
		nativeSessionId: 'native-thread',
		settings: { runtime: 'codex', modelId: 'model-a' },
	});
	const reopened = new CoderSessions(path.join(f.directory, 'coder', 'sessions', 'records'));
	const snapshot = reopened.snapshot(reopened.read(first.sessionId)!);
	expect(snapshot.blocks.map((block) => block.type)).toEqual([
		'message',
		'message',
		'tool',
		'message',
		'message',
		'message',
		'tool',
		'message',
	]);
	expect(readdirSync(f.project.directory)).toEqual([]);
	expect(
		readFileSync(
			path.join(f.directory, 'coder', 'sessions', 'records', first.sessionId + '.json'),
			'utf8'
		)
	).toContain('native-thread');
});

it('correlates approvals to the owner and cancels an approval wait', async () => {
	let ready!: () => void;
	const waiting = new Promise<void>((resolve) => {
		ready = resolve;
	});
	const f = fixture(async (_, context) => {
		await context.approve({ toolName: 'Write', input: { path: 'file' } });
		return '';
	});
	let approval: Extract<CodingResponseEvent, { type: 'interaction' }> | undefined;
	const pending = f.coding.send(
		8,
		'run-approval',
		{ projectId: 'project', mode: 'agent', input: 'Edit' },
		(event) => {
			if (event.type === 'interaction') {
				approval = event;
				ready();
			}
		}
	);
	await waiting;
	expect(f.coding.respond('run-approval', approval!.requestId, { approved: true }, 9)).toBe(false);
	expect(f.coding.cancel('run-approval', 9)).toBe(false);
	expect(f.coding.cancel('run-approval', 8)).toBe(true);
	await expect(pending).rejects.toBeDefined();
	expect(f.coding.respond('run-approval', approval!.requestId, { approved: true }, 8)).toBe(false);
	const snapshot = await f.coding.getSession('project', approval!.sessionId);
	expect(snapshot.blocks).toEqual(
		expect.arrayContaining([expect.objectContaining({ type: 'interaction', status: 'denied' })])
	);
});

it('allows only one active run per session and rejects changed directories', async () => {
	let release!: () => void;
	const stopped = new Promise<void>((resolve) => {
		release = resolve;
	});
	let ready!: () => void;
	const started = new Promise<void>((resolve) => {
		ready = resolve;
	});
	const f = fixture(async () => {
		ready();
		await stopped;
		return 'ok';
	});
	const session = f.sessions.create('project', f.project.directory, settings, 'Session');
	const pending = f.coding.send(
		1,
		'one',
		{ projectId: 'project', sessionId: session.id, mode: 'agent', input: 'hello' },
		() => {}
	);
	await started;
	await expect(
		f.coding.send(
			1,
			'two',
			{ projectId: 'project', sessionId: session.id, mode: 'agent', input: 'hello' },
			() => {}
		)
	).rejects.toThrow('active run');
	release();
	await pending;
	await expect(
		f.coding.saveSessionSettings('project', session.id, {
			...settings,
			workingDirectory: f.directory,
		})
	).rejects.toThrow('new session');
});

it('runs commands in the saved project without requiring a model or credentials', async () => {
	const f = fixture(async () => {
		throw new Error('Harness should not run');
	});
	const result = await f.coding.send(
		1,
		'command',
		{ projectId: 'project', mode: 'shell', input: 'pwd' },
		() => {}
	);
	expect(result.output.trim()).toBe(f.project.directory);
	const snapshot = await f.coding.getSession('project', result.sessionId);
	expect(snapshot.blocks).toEqual([
		expect.objectContaining({ type: 'command', status: 'succeeded', output: result.output }),
	]);
});
