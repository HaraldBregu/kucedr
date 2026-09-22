import type { ChildProcess } from 'node:child_process';

export function processTreeAlive(child: ChildProcess): boolean {
	if (process.platform !== 'win32' && child.pid) {
		try { process.kill(-child.pid, 0); return true; } catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'EPERM') return true;
		}
	}
	return child.exitCode === null && child.signalCode === null;
}
