import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { CodexRpc } from '../../../../src/main/coding/harness/rpc';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

describe('CodexRpc', () => {
	let child: EventEmitter & {
		stdin: PassThrough;
		stdout: PassThrough;
		stderr: PassThrough;
		kill: jest.Mock;
		exitCode: number | null;
	};
	beforeEach(() => {
		child = Object.assign(new EventEmitter(), {
			stdin: new PassThrough(),
			stdout: new PassThrough(),
			stderr: new PassThrough(),
			kill: jest.fn(),
			exitCode: null,
		});
		jest.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
	});

	it('isolates storage and correlates responses when they arrive out of order', async () => {
		const rpc = new CodexRpc('/bin/codex', '/coder/codex');
		const first = rpc.request('first', {});
		const second = rpc.request('second', {});
		child.stdout.write('{"id":2,"result":"second"}\n{"id":1,"result":"first"}\n');
		await expect(first).resolves.toBe('first');
		await expect(second).resolves.toBe('second');
		expect(spawn).toHaveBeenCalledWith(
			'/bin/codex',
			expect.arrayContaining(['cli_auth_credentials_store="file"', 'sqlite_home="/coder/codex"']),
			expect.objectContaining({
				cwd: '/coder/codex',
				env: expect.objectContaining({ CODEX_HOME: '/coder/codex' }),
			})
		);
		rpc.close();
	});

	it('rejects pending requests if the subprocess exits', async () => {
		const rpc = new CodexRpc('/bin/codex', '/coder/codex');
		const result = rpc.request('thread/start', {});
		child.emit('exit', 1);
		await expect(result).rejects.toThrow('Codex exited');
		await expect(rpc.request('model/list', {})).rejects.toThrow('Codex exited');
	});

	it('handles bidirectional requests without blocking notifications', async () => {
		const rpc = new CodexRpc('/bin/codex', '/coder/codex');
		rpc.onRequest = jest.fn().mockResolvedValue({ decision: 'decline' });
		rpc.onNotification = jest.fn();
		const data: string[] = [];
		child.stdin.on('data', (chunk) => data.push(chunk.toString()));
		child.stdout.write(
			'{"id":"approval-1","method":"approval","params":{}}\n{"method":"delta","params":{"delta":"hello"}}\n'
		);
		await Promise.resolve();
		expect(rpc.onNotification).toHaveBeenCalledWith('delta', { delta: 'hello' });
		expect(JSON.parse(data[0])).toEqual({ id: 'approval-1', result: { decision: 'decline' } });
		rpc.close();
	});
});
