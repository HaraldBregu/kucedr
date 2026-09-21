import type { Dispatch } from 'react';
import { useEffect, useRef } from 'react';
import {
	createInitialModelServiceState,
	getErrorMessage,
	getSelectedServiceModel,
	MODEL_SERVICE_DEFINITIONS,
} from '../setupConstants';
import type { ModelServiceDefinition, ModelServiceId, ModelServiceState } from '../setupTypes';
import type { SetupAction } from '../state/setupActions';
import type { SetupState } from '../state/setupState';

export async function loadModelServiceState(
	service: ModelServiceDefinition
): Promise<ModelServiceState> {
	const [selection, modelGroups] = await Promise.all([
		service.getSelection().catch(() => undefined),
		service.loadModelGroups().catch(() => []),
	]);
	const selectedGroup = selection
		? modelGroups.find((group) => group.provider.id === selection.providerId)
		: undefined;
	const selectedModel = selectedGroup?.models.find((model) => model.id === selection?.modelId);
	if ((selection?.providerId === 'ollama' || selection?.providerId === 'custom') && selectedGroup) {
		return {
			providerId: 'ollama',
			modelId: 'local',
			localModelId: selection.modelId,
			modelGroups,
		};
	}
	return {
		providerId: selectedModel ? (selectedGroup?.provider.id ?? '') : '',
		modelId: selectedModel?.id ?? '',
		modelGroups,
	};
}

export function useSetupModelServices(state: SetupState, dispatch: Dispatch<SetupAction>) {
	const { step, serviceStates, savingConfig } = state;
	const modelsLoadedRef = useRef(false);

	useEffect(() => {
		if (step === 'modelProvider') {
			modelsLoadedRef.current = false;
		}
	}, [step]);

	useEffect(() => {
		if (step !== 'models') return;
		if (modelsLoadedRef.current) return;
		let cancelled = false;

		async function loadAllServices(): Promise<void> {
			dispatch({ type: 'SET_LOADING_MODELS', loading: true });
			dispatch({ type: 'CLEAR_ERROR' });
			try {
				const loadedStates = await Promise.all(
					MODEL_SERVICE_DEFINITIONS.map((service) => loadModelServiceState(service))
				);
				if (cancelled) return;
				const nextServiceStates = createInitialModelServiceState();
				MODEL_SERVICE_DEFINITIONS.forEach((service, index) => {
					nextServiceStates[service.id] = loadedStates[index];
				});
				dispatch({ type: 'LOAD_SERVICE_STATES', states: nextServiceStates });
				modelsLoadedRef.current = true;
			} catch (error) {
				if (cancelled) return;
				console.error('[useSetupModelServices] Failed to load service configuration:', error);
				dispatch({ type: 'LOAD_SERVICE_STATES', states: createInitialModelServiceState() });
				dispatch({
					type: 'SET_ERROR',
					message: getErrorMessage(error, 'Could not load models.'),
				});
			} finally {
				if (!cancelled) {
					dispatch({ type: 'SET_LOADING_MODELS', loading: false });
				}
			}
		}

		void loadAllServices();
		return () => {
			cancelled = true;
		};
	}, [step, dispatch]);

	async function handleServiceChange(
		serviceId: ModelServiceId,
		providerId: string,
		modelId: string
	): Promise<void> {
		dispatch({ type: 'CLEAR_ERROR' });
		const isAssistantLocalModel = serviceId === 'assistant' && providerId === 'ollama';
		dispatch({
			type: 'CHANGE_SERVICE_SELECTION',
			serviceId,
			providerId,
			modelId: isAssistantLocalModel ? 'local' : modelId,
		});
		if (isAssistantLocalModel) {
			dispatch({ type: 'SET_LOCAL_MODEL', serviceId, modelId });
		}

		const service = MODEL_SERVICE_DEFINITIONS.find((item) => item.id === serviceId);
		if (!service?.saveOnChange) return;
		const selected = getSelectedServiceModel({
			...serviceStates[serviceId],
			providerId,
			modelId: isAssistantLocalModel ? 'local' : modelId,
			localModelId: isAssistantLocalModel ? modelId : undefined,
		});
		if (!selected) return;

		dispatch({ type: 'SET_SAVING_CONFIG', saving: true });
		try {
			const saved = await service.saveSelection(selected.provider, selected.model);
			if (!saved) throw new Error(`Could not save the selected ${service.title} model.`);
		} catch (error) {
			console.error('[useSetupModelServices] Failed to save model service config:', error);
			dispatch({
				type: 'SET_ERROR',
				message: getErrorMessage(error, `Could not save the selected ${service.title} model.`),
			});
		} finally {
			dispatch({ type: 'SET_SAVING_CONFIG', saving: false });
		}
	}

	async function handleSaveModels(): Promise<boolean> {
		if (savingConfig) return false;

		dispatch({ type: 'SET_SAVING_CONFIG', saving: true });
		dispatch({ type: 'CLEAR_ERROR' });
		try {
			for (const service of MODEL_SERVICE_DEFINITIONS) {
				const selected = getSelectedServiceModel(serviceStates[service.id]);
				if (!selected) continue;
				const saved = await service.saveSelection(selected.provider, selected.model);
				if (!saved) {
					throw new Error(`Could not save the selected ${service.title} model.`);
				}
			}
			return true;
		} catch (error) {
			console.error('[useSetupModelServices] Failed to save model service config:', error);
			dispatch({
				type: 'SET_ERROR',
				message: getErrorMessage(error, 'Could not save your model selections.'),
			});
			return false;
		} finally {
			dispatch({ type: 'SET_SAVING_CONFIG', saving: false });
		}
	}

	return {
		handleServiceChange,
		handleSaveModels,
	};
}
