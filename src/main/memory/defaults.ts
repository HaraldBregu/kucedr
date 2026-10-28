import type { MemoryState } from './types';

export function defaultState(): MemoryState {
	return {
		config: {
			enabled: true,
			includeInPrompt: true,
			providerId: '',
			modelId: '',
			modelOptions: {},
			memoryType: 'both',
		},
		initialized: false,
		modelInitialized: false,
		checkpoints: {},
		suppressed: [],
		lastSuccess: null,
	};
}
