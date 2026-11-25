import { powerMonitor } from 'electron';
import { getLock, lock } from './state';

export function watchIdle(): void {
	powerMonitor.on('lock-screen', lock);
	powerMonitor.on('suspend', lock);
	setInterval(() => {
		const { idleMinutes } = getLock();
		if (idleMinutes > 0 && powerMonitor.getSystemIdleTime() >= idleMinutes * 60) lock();
	}, 30_000);
}
