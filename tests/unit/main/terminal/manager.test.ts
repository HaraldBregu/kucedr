import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import type { IDisposable, IPty } from 'node-pty';
import type { LoggerService } from '../../../../src/main/shared';
import type { EnvironmentManager } from '../../../../src/main/terminal/environment';
import { PtyManager } from '../../../../src/main/terminal/manager';
import type { ShellDetector } from '../../../../src/main/terminal/shell';
import { TerminalChannels } from '../../../../src/shared/ipc_channels_definitions';

interface PtyHarness {
	readonly process: IPty;
	readonly write: jest.Mock;
	readonly resize: jest.Mock;
	readonly kill: jest.Mock;
	emitData(data: string): void;
	emitExit(exitCode: number, signal?: number): void;
}

function createPtyHarness(): PtyHarness {
	let dataListener: (data: string) => void = () => undefined;
	let exitListener: (event: { exitCode: number; signal?: number }) => void = () => undefined;
	const disposable = (): IDisposable => ({ dispose: jest.fn() });
	const write = jest.fn();
	const resize = jest.fn();
	const kill = jest.fn();
	const process = {
		pid: 123,
		cols: 80,
		rows: 24,
		process: 'zsh',
		handleFlowControl: false,
		onData: (listener: (data: string) => void) => {
			dataListener = listener;
			return disposable();
		},
		onExit: (listener: (event: { exitCode: number; signal?: number }) => void) => {
			exitListener = listener;
			return disposable();
		},
		write,
		resize,
		kill,
		clear: jest.fn(),
		pause: jest.fn(),
		resume: jest.fn(),
	} as IPty;
	return {
		process,
		write,
		resize,
		kill,
		emitData: (data) => dataListener(data),
		emitExit: (exitCode, signal) => exitListener({ exitCode, signal }),
	};
}

function createOwner(id: number): WebContents {
	const owner = new EventEmitter() as EventEmitter & {
		id: number;
		send: jest.Mock;
		isDestroyed: jest.Mock;
	};
	owner.id = id;
	owner.send = jest.fn();
	owner.isDestroyed = jest.fn(() => false);
	return owner as unknown as WebContents;
}

it('routes PTY data only to the owner and enforces owner control', async () => {
	const harness = createPtyHarness();
	const owner = createOwner(7);
	const manager = new PtyManager(
		{ info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as LoggerService,
		{ detect: () => ({ executable: '/bin/zsh', args: ['-l'] }) } as ShellDetector,
		{ get: async () => ({ PATH: '/usr/bin' }) } as EnvironmentManager,
		jest.fn(() => harness.process)
	);

	await expect(
		manager.create(owner, { id: 'terminal-1234', cols: 80, rows: 24, cwd: process.cwd() })
	).resolves.toMatchObject({ id: 'terminal-1234', shell: '/bin/zsh' });
	harness.emitData('hel');
	harness.emitData('lo');
	expect(owner.send).not.toHaveBeenCalled();
	await new Promise((resolve) => setTimeout(resolve, 20));
	expect(owner.send).toHaveBeenCalledTimes(1);
	expect(owner.send).toHaveBeenCalledWith(TerminalChannels.data, {
		id: 'terminal-1234',
		data: 'hello',
	});
	expect(manager.write(7, 'terminal-1234', 'ls\r')).toBe(true);
	expect(harness.write).toHaveBeenCalledWith('ls\r');
	expect(manager.resize(7, 'terminal-1234', 120, 40)).toBe(true);
	expect(harness.resize).toHaveBeenCalledWith(120, 40);
	expect(() => manager.write(8, 'terminal-1234', 'whoami\r')).toThrow(
		'Terminal session is owned by another window.'
	);
});

it('reports natural exits and kills sessions when their owner is destroyed', async () => {
	const firstPty = createPtyHarness();
	const secondPty = createPtyHarness();
	const owner = createOwner(9);
	const processes = [firstPty.process, secondPty.process];
	const manager = new PtyManager(
		{ info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as LoggerService,
		{ detect: () => ({ executable: '/bin/zsh', args: ['-l'] }) } as ShellDetector,
		{ get: async () => ({}) } as EnvironmentManager,
		jest.fn(() => processes.shift() as IPty)
	);

	await manager.create(owner, { id: 'terminal-first', cols: 80, rows: 24 });
	firstPty.emitExit(0);
	expect(owner.send).toHaveBeenCalledWith(TerminalChannels.exit, {
		id: 'terminal-first',
		exitCode: 0,
		signal: undefined,
	});
	expect(manager.count).toBe(0);

	await manager.create(owner, { id: 'terminal-second', cols: 80, rows: 24 });
	owner.emit('destroyed');
	expect(secondPty.kill).toHaveBeenCalledTimes(1);
	expect(manager.count).toBe(0);
});
