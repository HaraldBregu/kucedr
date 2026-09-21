import { createInitialModelServiceState } from '../setupConstants';
import type { SetupAction } from './setupActions';
import type { SetupState } from './setupState';

export function createInitialSetupState(): SetupState {
	return {
		step: 'modelProvider',
		serviceStates: createInitialModelServiceState(),
		loadingModels: false,
		savingConfig: false,
		errorMessage: '',
	};
}

export function setupReducer(state: SetupState, action: SetupAction): SetupState {
	switch (action.type) {
		case 'GO_TO_STEP':
			return { ...state, step: action.step, errorMessage: '' };

		case 'SET_ERROR':
			return { ...state, errorMessage: action.message };

		case 'CLEAR_ERROR':
			return { ...state, errorMessage: '' };

		case 'SET_LOADING_MODELS':
			return { ...state, loadingModels: action.loading };

		case 'LOAD_SERVICE_STATES':
			return { ...state, serviceStates: action.states };

		case 'CHANGE_SERVICE_SELECTION':
			return {
				...state,
				serviceStates: {
					...state.serviceStates,
					[action.serviceId]: {
						...state.serviceStates[action.serviceId],
						providerId: action.providerId,
						modelId: action.modelId,
						localModelId: undefined,
					},
				},
			};

		case 'SET_LOCAL_MODEL':
			return {
				...state,
				serviceStates: {
					...state.serviceStates,
					[action.serviceId]: {
						...state.serviceStates[action.serviceId],
						localModelId: action.modelId,
					},
				},
			};

		case 'SET_SAVING_CONFIG':
			return { ...state, savingConfig: action.saving };

		default:
			return state;
	}
}
