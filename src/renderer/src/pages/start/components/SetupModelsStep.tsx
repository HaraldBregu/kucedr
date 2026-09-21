import React, { useEffect, useMemo, useState } from 'react';
import {
	BrainCircuit,
	ImageIcon,
	Mic,
	Music,
	Radio,
	Video,
	Volume2,
	type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@/components/ui/combobox';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { ModelProviderSelect, toModelProviderGroups } from '@/components/model-provider-select';
import RealtimeConversationConfiguration from '@pages/settings/pages/assistant/conversation';
import { SetupSearch } from './SetupSearch';
import { SetupStepHeader } from './SetupStepHeader';
import { MODEL_SERVICE_DEFINITIONS, STEP_COPY } from '../setupConstants';
import type { ModelServiceId, ModelServiceStateMap } from '../setupTypes';

const ASSISTANT_SERVICE_IDS = new Set<ModelServiceId>(['assistant', 'voice', 'transcription']);
const TOOL_SERVICE_IDS = new Set<ModelServiceId>(['image', 'video', 'audio']);

const SERVICE_ICONS: Partial<Record<ModelServiceId, LucideIcon>> = {
	assistant: BrainCircuit,
	voice: Volume2,
	transcription: Mic,
	image: ImageIcon,
	video: Video,
	audio: Music,
};

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

export function SetupLocalModelSelector({
	selectedModelId,
	onChange,
}: {
	readonly selectedModelId?: string;
	readonly onChange: (modelId: string) => void;
}): React.JSX.Element {
	const [models, setModels] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!window.provider) return;
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
		<div className="border-t border-border/60 pt-1">
			<Item variant="outline" size="md" className="border-b border-border/60 px-4 py-3">
				<ItemContent className="min-w-0 flex-col items-start gap-0.5">
					<ItemTitle>Local provider</ItemTitle>
				</ItemContent>
				<ItemActions className="ml-auto w-full flex-none justify-end sm:w-40">
					<Select value="ollama" disabled>
						<SelectTrigger
							id="setup-assistant-local-provider"
							aria-label="Local provider"
							className="h-8 w-40"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ollama">Ollama</SelectItem>
						</SelectContent>
					</Select>
				</ItemActions>
			</Item>
			<Item variant="outline" size="md" className="px-4 py-3">
				<ItemContent className="min-w-0 flex-col items-start gap-0.5">
					<ItemTitle>Local model</ItemTitle>
				</ItemContent>
				<ItemActions className="ml-auto w-full flex-none justify-end sm:w-40">
					<Combobox
						items={models}
						value={selectedModelId}
						disabled={loading || models.length === 0}
						onValueChange={(value) => {
							if (value) onChange(value);
						}}
					>
						<ComboboxInput
							id="setup-assistant-local-model"
							aria-label="Local model"
							className="w-40"
							placeholder={loading ? 'Loading models...' : 'Search models...'}
						/>
						<ComboboxContent>
							<ComboboxEmpty>No matching models.</ComboboxEmpty>
							<ComboboxList>
								{(model: string) => (
									<ComboboxItem key={model} value={model}>
										{model}
									</ComboboxItem>
								)}
							</ComboboxList>
						</ComboboxContent>
					</Combobox>
				</ItemActions>
			</Item>
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
	const [availableLocalModels, setAvailableLocalModels] = useState<string[]>([]);
	const assistantServices = MODEL_SERVICE_DEFINITIONS.filter((service) =>
		ASSISTANT_SERVICE_IDS.has(service.id)
	);
	const toolServices = MODEL_SERVICE_DEFINITIONS.filter((service) =>
		TOOL_SERVICE_IDS.has(service.id)
	);
	const assistantModelGroups = useMemo(
		() =>
			serviceStates.assistant.modelGroups.map((group) =>
				group.provider.id === 'custom' && availableLocalModels.length > 0
					? { ...group, models: availableLocalModels.map((id) => ({ id, name: id })) }
					: group
			),
		[availableLocalModels, serviceStates.assistant.modelGroups]
	);

	useEffect(() => {
		if (!window.provider) return;
		let cancelled = false;
		void window.provider
			.list('models')
			.then((providers) => providers.find((provider) => provider.id === 'custom'))
			.then((provider) =>
				provider
					? window.provider.listCustomModels({ baseUrl: provider.baseUrl, apiKey: provider.apiKey })
					: []
			)
			.then((models) => {
				if (!cancelled) setAvailableLocalModels(models);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="mx-auto flex min-h-full w-full min-w-0 max-w-2xl flex-col justify-center py-8">
			<SetupStepHeader title={STEP_COPY.models.title} description={STEP_COPY.models.description} />

			<div className="mt-6 grid min-w-0 gap-6">
				<section aria-label="Chat Assistant" className="min-w-0">
					<h2 className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
						Chat Assistant
					</h2>
					<Card size="sm" className="gap-0! p-0!">
						<CardContent className="p-0!">
							{assistantServices.map((service) => {
								const Icon = SERVICE_ICONS[service.id];
								const serviceState = serviceStates[service.id];
								const title = service.id === 'assistant' ? 'LLM Model' : service.title;
								const providerGroups =
									service.id === 'assistant' ? assistantModelGroups : serviceState.modelGroups;
								const selectedModelId =
									service.id === 'assistant' && serviceState.providerId === 'custom'
										? (serviceState.localModelId ?? serviceState.modelId)
										: serviceState.modelId;
								return (
									<React.Fragment key={service.id}>
										<Item
											data-testid={`setup-${service.id}`}
											variant="outline"
											size="md"
											className="border-b border-border/60 px-4 py-3 last:border-b-0"
										>
											{Icon && (
												<ItemMedia variant="icon" className="bg-transparent">
													<Icon className="size-5" aria-hidden="true" />
												</ItemMedia>
											)}
											<ItemContent className="min-w-0 flex-col items-start gap-0.5">
												<ItemTitle>{title}</ItemTitle>
												<p className="text-[11px] leading-4 text-muted-foreground">
													{service.description}
												</p>
											</ItemContent>
											<ItemActions className="ml-auto w-full flex-none justify-end sm:w-80">
												<ModelProviderSelect
													inline
													buttonDropdown
													buttonClassName="w-40 min-w-0"
													idPrefix={`setup-${service.id}`}
													providerGroups={toModelProviderGroups(providerGroups)}
													providerId={serviceState.providerId}
													modelId={selectedModelId}
													disabled={
														loadingModels || savingConfig || serviceState.modelGroups.length === 0
													}
													showFieldLabel={false}
													labels={{ label: title, placeholder: 'Select a model' }}
													onChange={(providerId, modelId) => {
														if (service.id === 'assistant' && providerId === 'custom') {
														onServiceChange('assistant', 'custom', modelId);
															return;
														}
														onServiceChange(service.id, providerId, modelId);
													}}
												/>
											</ItemActions>
										</Item>
									</React.Fragment>
								);
							})}
						</CardContent>
					</Card>
				</section>
				<section aria-label="Voice Assistant" className="min-w-0">
					<h2 className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
						Voice Assistant
					</h2>
					<Card size="sm" className="gap-0! p-0!">
						<CardContent className="p-0!">
							<RealtimeConversationConfiguration
								selectDefaultModel={false}
								showFieldLabel={false}
								showSelectedModel
								buttonDropdown
								buttonClassName="w-40 min-w-0"
								icon={Radio}
							/>
						</CardContent>
					</Card>
				</section>
				<section aria-label="Tools" className="min-w-0">
					<h2 className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
						Tools
					</h2>
					<Card size="sm" className="gap-0! p-0!">
						<CardContent className="p-0!">
							<SetupSearch />
							{toolServices.map((service) => {
								const Icon = SERVICE_ICONS[service.id];
								const serviceState = serviceStates[service.id];
								return (
									<Item
										key={service.id}
										data-testid={`setup-${service.id}`}
										variant="outline"
										size="md"
										className="border-b border-border/60 px-4 py-3 last:border-b-0"
									>
										{Icon && (
											<ItemMedia variant="icon" className="bg-transparent">
												<Icon className="size-5" aria-hidden="true" />
											</ItemMedia>
										)}
										<ItemContent className="min-w-0 flex-col items-start gap-0.5">
											<ItemTitle>{service.title}</ItemTitle>
											<p className="text-[11px] leading-4 text-muted-foreground">
												{service.description}
											</p>
										</ItemContent>
										<ItemActions className="ml-auto w-full flex-none justify-end sm:w-80">
											<ModelProviderSelect
												inline
												buttonDropdown
												buttonClassName="w-40 min-w-0"
												idPrefix={`setup-${service.id}`}
												providerGroups={toModelProviderGroups(serviceState.modelGroups)}
												providerId={serviceState.providerId}
												modelId={serviceState.modelId}
												disabled={
													loadingModels || savingConfig || serviceState.modelGroups.length === 0
												}
												showFieldLabel={false}
												labels={{ label: service.title, placeholder: 'Select a model' }}
												onChange={(providerId, modelId) =>
													onServiceChange(service.id, providerId, modelId)
												}
											/>
										</ItemActions>
									</Item>
								);
							})}
						</CardContent>
					</Card>
				</section>
			</div>
		</div>
	);
}
