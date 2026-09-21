import type { ModelServiceId, ModelServiceStateMap, SetupStep } from '../setupTypes';

export type SetupAction =
	| { type: 'GO_TO_STEP'; step: SetupStep }
	| { type: 'SET_ERROR'; message: string }
	| { type: 'CLEAR_ERROR' }
	| { type: 'SET_LOADING_MODELS'; loading: boolean }
	| { type: 'LOAD_SERVICE_STATES'; states: ModelServiceStateMap }
	| { type: 'CHANGE_SERVICE_SELECTION'; serviceId: ModelServiceId; providerId: string; modelId: string }
	| { type: 'SET_LOCAL_MODEL'; serviceId: ModelServiceId; modelId: string }
	| { type: 'SET_SAVING_CONFIG'; saving: boolean };
