import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const terminating = new WeakSet<ChildProcess>();

export function terminateProcessTree(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): void {
	const send = (next: NodeJS.Signals): void => {
		if (process.platform === 'win32' && child.pid) {
			const executable = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
			const killer = spawn(executable, ['/PID', String(child.pid), '/T', ...(next === 'SIGKILL' ? ['/F'] : [])], { stdio: 'ignore', windowsHide: true });
			killer.once('error', () => child.kill(next));
			killer.unref();
			return;
		}
		if (child.pid) {
			try { process.kill(-child.pid, next); return; } catch { child.kill(next); return; }
		}
		child.kill(next);
	};
	send(signal);
	if (signal !== 'SIGTERM' || terminating.has(child)) return;
	terminating.add(child);
	const timer = setTimeout(() => send('SIGKILL'), 1_000);
	timer.unref?.();
}
