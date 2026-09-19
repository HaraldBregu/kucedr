import type { MemoryState } from './types';

export function defaultState(): MemoryState {
	return {
		config: { enabled: true, providerId: '', modelId: '', modelOptions: {}, memoryType: 'both',
			scheduleEnabled: true, cronExpression: '*/15 * * * *', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
		initialized: false, modelInitialized: false, checkpoints: {}, suppressed: [], lastSuccess: null,
	};
}
