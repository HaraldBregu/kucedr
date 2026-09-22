import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { terminateProcessTree } from '../../../../../src/main/agent/execution/terminate';
import { superviseProcess } from '../../../../../src/main/agent/execution/supervise';

const unix = process.platform === 'win32' ? it.skip : it;

unix('escalates termination for a process group that ignores SIGTERM', async () => {
	const child = spawn('/bin/sh', ['-c', 'trap "" TERM; echo ready; sleep 30'], { detached: true });
	try {
		await once(child.stdout, 'data');
		const closed = once(child, 'close');
		terminateProcessTree(child);
		await expect(closed).resolves.toEqual([null, 'SIGKILL']);
	} finally {
		if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
	}
}, 5_000);

unix('retains cancellation ownership after a shell exits with a live descendant', async () => {
	const child = spawn('/bin/sh', ['-c', 'sleep 30 &'], { detached: true, stdio: 'ignore' });
	const controller = new AbortController();
	superviseProcess(child, controller.signal);
	try {
		await once(child, 'close');
		expect(child.exitCode).toBe(0);
		expect(() => process.kill(-child.pid!, 0)).not.toThrow();
		controller.abort();
		await new Promise((resolve) => setTimeout(resolve, 1_200));
		expect(() => process.kill(-child.pid!, 0)).toThrow();
	} finally {
		if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
	}
}, 5_000);
