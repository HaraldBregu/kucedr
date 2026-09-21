import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
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
	readonly onLocalModelChange: (serviceId: ModelServiceId, modelId: string) => void;
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

function SetupLocalModelSelector({
	selectedModelId,
	onChange,
}: {
	readonly selectedModelId?: string;
	readonly onChange: (modelId: string) => void;
}): React.JSX.Element {
	const [models, setModels] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		void window.provider
			.list('models')
			.then((providers) => providers.find((provider) => provider.id === 'custom'))
			.then((provider) =>
				provider
					? window.provider.listCustomModels({
							baseUrl: provider.baseUrl,
							apiKey: provider.apiKey,
						})
					: []
			)
			.then((availableModels) => {
				if (!cancelled) setModels(availableModels);
			})
			.catch(() => {
				if (!cancelled) setModels([]);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="grid gap-3 pt-3">
			<div className="grid gap-1.5">
				<Label htmlFor="setup-assistant-local-provider">Local provider</Label>
				<Select value="ollama" disabled>
					<SelectTrigger id="setup-assistant-local-provider">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ollama">Ollama</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor="setup-assistant-local-model">Local model</Label>
				<Select
					value={selectedModelId}
					disabled={loading || models.length === 0}
					onValueChange={(value) => onChange(String(value))}
				>
					<SelectTrigger id="setup-assistant-local-model">
						<SelectValue placeholder={loading ? 'Loading models...' : 'Select a model'} />
					</SelectTrigger>
					<SelectContent>
						{models.map((model) => (
							<SelectItem key={model} value={model}>
								{model}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

export function SetupModelsStep({
	serviceStates,
	loadingModels,
	savingConfig,
	onServiceChange,
	onLocalModelChange,
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
									>
										{service.id === 'assistant' &&
											serviceStates.assistant.providerId === 'custom' && (
												<SetupLocalModelSelector
													selectedModelId={serviceStates.assistant.localModelId}
													onChange={(modelId) => onLocalModelChange('assistant', modelId)}
												/>
											)}
									</ModelProviderConfiguration>
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
