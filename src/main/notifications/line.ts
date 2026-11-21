import type { RunSignal } from '../agent/types';
import { HEALTH_OK } from '../health/run';

export function notificationLine(signal: RunSignal): string | undefined {
	if (signal.phase === 'waiting') return signal.category === 'main' ? signal.reason : undefined;
	if (signal.phase !== 'finished' || signal.stopReason === 'cancelled') return undefined;
	const failed = signal.stopReason === 'error' || signal.stopReason === 'timeout';
	if (signal.category === 'main') return failed ? 'failed' : 'ready';
	if (signal.category === 'task') return failed ? 'taskFailed' : 'taskFinished';
	if (signal.category === 'health')
		return failed
			? 'healthFailed'
			: signal.text.trim() === HEALTH_OK
				? undefined
				: 'healthAttention';
	return undefined;
}
