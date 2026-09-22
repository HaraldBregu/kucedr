import { executionScope } from '../../../../../src/main/agent/execution/scope';
import type { Tool } from '../../../../../src/main/agent/types';

const scope = { ownerId: 'window:1', source: 'interactive' as const, sessionId: 'session', runId: 'run' };
const ownedRun = (tool: Tool, input: Record<string, unknown>, signal?: AbortSignal) => executionScope.run(scope, () => tool.run(input, signal));

import { EventEmitter } from 'node:events';

const spawn = jest.fn();

jest.mock('node:child_process', () => ({ spawn }));

import { execTool } from '../../../../../src/main/agent/tools/core/bash';
import type { ExecSandbox } from '../../../../../src/main/agent/sandbox';
import {
	processTool,
	registry,
	type ProcessSession,
} from '../../../../../src/main/agent/tools/core/process';

function childProcess() {
	const child = new EventEmitter() as EventEmitter & {
		pid: number;
		stdout: EventEmitter;
		stderr: EventEmitter;
		stdin: { write: jest.Mock };
		kill: jest.Mock;
		unref: jest.Mock;
	};
	child.pid = 42;
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.stdin = { write: jest.fn() };
	child.unref = jest.fn();
	child.kill = jest.fn(() => {
		queueMicrotask(() => child.emit('close', null, 'SIGTERM'));
		return true;
	});
	return child;
}

function sandbox(): ExecSandbox {
	return {
		wrap: jest.fn(async (command: string) => ({ command, args: [], env: {}, commandId: 'id' })),
		track: jest.fn(),
		cleanup: jest.fn(),
		annotate: jest.fn((_id: string, stderr: string) => stderr),
	} as unknown as ExecSandbox;
}

it('kills only the exec child when its run is cancelled', async () => {
	const child = childProcess();
	const unrelated = childProcess();
	spawn.mockReturnValue(child);
	registry.register({
		id: 'unrelated',
		scope,
		pid: unrelated.pid,
		command: 'other',
		workdir: '/tmp',
		roots: [],
		executionMode: 'sandbox',
		startedAt: Date.now(),
		stdout: '',
		stderr: '',
		exitCode: undefined,
		exitSignal: undefined,
		exited: false,
		child: unrelated as never,
	});
	const controller = new AbortController();
	const result = ownedRun(execTool(sandbox()),
		{ command: 'long command', workdir: '/tmp', yieldMs: 10_000 },
		controller.signal
	);
	const reason = new Error('cancel exec');
	controller.abort(reason);

	await expect(result).rejects.toBe(reason);
	expect(child.kill).toHaveBeenCalledWith('SIGTERM');
	expect(unrelated.kill).not.toHaveBeenCalled();
	expect(registry.get('unrelated')).toBeDefined();
	registry.remove('unrelated');
});

it('kills a background exec cancelled before its spawn acknowledgement', async () => {
	const child = childProcess();
	spawn.mockReturnValue(child);
	const controller = new AbortController();
	const result = ownedRun(execTool(sandbox()),
		{ command: 'background command', workdir: '/tmp', background: true },
		controller.signal
	);
	const reason = new Error('cancel background exec');
	controller.abort(reason);

	await expect(result).rejects.toBe(reason);
	expect(child.kill).toHaveBeenCalledWith('SIGTERM');
});

it('keeps background exec ownership until the parent run is cancelled', async () => {
	const child = childProcess();
	spawn.mockReturnValue(child);
	const controller = new AbortController();
	const result = ownedRun(execTool(sandbox()),
		{ command: 'background command', workdir: '/tmp', background: true },
		controller.signal
	);
	await new Promise((resolve) => setImmediate(resolve));
	child.emit('spawn');
	await expect(result).resolves.toMatchObject({ background: true, pid: child.pid });
	controller.abort(new Error('cancel owning run'));

	expect(child.kill).toHaveBeenCalledWith('SIGTERM');
});

it('kills and removes a yielded exec session when its parent run is cancelled', async () => {
	const child = childProcess();
	spawn.mockReturnValue(child);
	const controller = new AbortController();
	const result = await ownedRun(execTool(sandbox()),
		{ command: 'yielded command', workdir: '/tmp', yieldMs: 0 },
		controller.signal
	);
	const sessionId = (result as { sessionId: string }).sessionId;
	expect(registry.get(sessionId)).toBeDefined();
	controller.abort(new Error('cancel owning run'));

	expect(child.kill).toHaveBeenCalledWith('SIGTERM');
	expect(registry.get(sessionId)).toBeUndefined();
});

it('cancels a process poll without killing or removing its existing session', async () => {
	const child = childProcess();
	const session: ProcessSession = {
		id: 'existing',
		scope,
		pid: child.pid,
		command: 'existing command',
		workdir: '/tmp',
		roots: [],
		executionMode: 'sandbox',
		startedAt: Date.now(),
		stdout: '',
		stderr: '',
		exitCode: undefined,
		exitSignal: undefined,
		exited: false,
		child: child as never,
	};
	registry.register(session);
	const controller = new AbortController();
	const result = ownedRun(processTool,
		{ action: 'poll', sessionId: session.id, timeout: 30_000 },
		controller.signal
	);
	const reason = new Error('cancel poll');
	controller.abort(reason);

	await expect(result).rejects.toBe(reason);
	expect(child.kill).not.toHaveBeenCalled();
	expect(registry.get(session.id)).toBe(session);
	registry.remove(session.id);
});

it('limits process listing and input to the originating owner and session', async () => {
	const child = childProcess();
	const session: ProcessSession = {
		id: 'isolated', scope, pid: child.pid, command: 'sensitive command', workdir: '/tmp', roots: [],
		executionMode: 'sandbox', startedAt: Date.now(), stdout: 'private output', stderr: '',
		exitCode: undefined, exitSignal: undefined, exited: false, child: child as never,
	};
	registry.register(session);
	try {
		const foreign = { ...scope, ownerId: 'channel:untrusted', source: 'channel' as const };
		await expect(executionScope.run(foreign, () => processTool.run({ action: 'list' }))).resolves.toEqual([]);
		await expect(executionScope.run(foreign, () => processTool.run({ action: 'log', sessionId: session.id }))).rejects.toThrow('not found');
		await expect(executionScope.run(foreign, () => processTool.run({ action: 'write', sessionId: session.id, text: 'whoami' }))).rejects.toThrow('not found');
		expect(child.stdin.write).not.toHaveBeenCalled();
		await expect(ownedRun(processTool, { action: 'write', sessionId: session.id, text: 'ok' })).resolves.toMatchObject({ written: 2 });
	} finally { registry.remove(session.id); }
});

it('requires an owner for direct process access', async () => {
	await expect(processTool.run({ action: 'list' })).rejects.toThrow('owning session');
});
