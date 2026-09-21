import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ModelProviderConfiguration } from '@pages/settings/components/model-configuration';
import RealtimeConversationConfiguration from '@pages/settings/pages/assistant/conversation';
import { SetupSearch } from './SetupSearch';
import { SetupStepHeader } from './SetupStepHeader';
import { getProviderCatalogItem, MODEL_SERVICE_DEFINITIONS, STEP_COPY } from '../setupConstants';
import type { ModelConfigurationState } from '@pages/settings/components/model-configuration-state';
import type { ModelServiceId, ModelServiceState, ModelServiceStateMap } from '../setupTypes';

const ASSISTANT_SERVICE_IDS = new Set<ModelServiceId>([
	'assistant',
	'voice',
	'transcription',
	'image',
	'video',
	'audio',
]);

type SetupModelsStepProps = {
	readonly serviceStates: ModelServiceStateMap;
	readonly loadingModels: boolean;
	readonly savingConfig: boolean;
	readonly onServiceChange: (
		serviceId: ModelServiceId,
		providerId: string,
		modelId: string
	) => void;
};

function toModelConfigurationState(
	serviceState: ModelServiceState,
	loadingModels: boolean,
	savingConfig: boolean
): ModelConfigurationState {
	return {
		providers: serviceState.modelGroups.map((group) => group.provider),
		modelGroups: serviceState.modelGroups,
		providerId: serviceState.providerId,
		modelId: serviceState.modelId,
		loading: loadingModels && serviceState.modelGroups.length === 0,
		loadingModels,
		saving: savingConfig,
		saved: false,
		error: null,
	};
}

function getSelectionSummary(serviceState: ModelServiceState, fallback: string): string {
	const group = serviceState.modelGroups.find(
		(item) => item.provider.id === serviceState.providerId
	);
	const model = group?.models.find((item) => item.id === serviceState.modelId);
	return group && model
		? `${group.provider.name || getProviderCatalogItem(group.provider.id).name} - ${model.name || model.id}`
		: fallback;
}

export function SetupModelsStep({
	serviceStates,
	loadingModels,
	savingConfig,
	onServiceChange,
}: SetupModelsStepProps): React.JSX.Element {
	const assistantServices = MODEL_SERVICE_DEFINITIONS.filter((service) =>
		ASSISTANT_SERVICE_IDS.has(service.id)
	);

	return (
		<div className="mx-auto flex min-h-full w-full min-w-0 max-w-2xl flex-col justify-center py-8">
			<SetupStepHeader title={STEP_COPY.models.title} description={STEP_COPY.models.description} />

			<div className="mt-6 grid min-w-0 gap-6">
				<section aria-label="Model providers" className="min-w-0">
					<Card size="sm" className="gap-0! p-0!">
						<CardContent className="p-0!">
							{assistantServices.map((service, index) => (
								<React.Fragment key={service.id}>
									<ModelProviderConfiguration
										configState={toModelConfigurationState(
											serviceStates[service.id],
											loadingModels,
											savingConfig
										)}
										idPrefix={`setup-${service.id}`}
										description={service.description}
										triggerTitle={service.title}
										triggerDescription={getSelectionSummary(
											serviceStates[service.id],
											'Select a model'
										)}
										showIcon={false}
										showFieldLabel={false}
										grouped
										defaultOpen={index === 0}
										onChange={(providerId, modelId) =>
											onServiceChange(service.id, providerId, modelId)
										}
									/>
									{service.id === 'assistant' && (
										<RealtimeConversationConfiguration
											selectDefaultModel={false}
											showFieldLabel={false}
										/>
									)}
								</React.Fragment>
							))}
							<SetupSearch />
						</CardContent>
					</Card>
				</section>
			</div>
		</div>
	);
}
