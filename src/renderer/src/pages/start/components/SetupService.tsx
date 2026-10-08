import React from 'react';
import { BrainCircuit, ImageIcon, Mic, Music, Video, Volume2 } from 'lucide-react';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { ModelProviderSelect, toModelProviderGroups } from '@/components/model-provider-select';
import type { ModelServiceDefinition, ModelServiceId, ModelServiceState, ModelServiceStateMap } from '../setupTypes';

export type SetupAssistantProps = {
	readonly serviceStates: ModelServiceStateMap;
	readonly loadingModels: boolean;
	readonly savingConfig: boolean;
	readonly onServiceChange: (serviceId: ModelServiceId, providerId: string, modelId: string) => void;
};

type SetupServiceProps = {
	readonly service: ModelServiceDefinition;
	readonly state: ModelServiceState;
	readonly disabled: boolean;
	readonly onChange: SetupAssistantProps['onServiceChange'];
};

const ICONS = {
	assistant: BrainCircuit,
	voice: Volume2,
	transcription: Mic,
	image: ImageIcon,
	video: Video,
	audio: Music,
	health: BrainCircuit,
	tasks: BrainCircuit,
};

export function SetupService({ service, state, disabled, onChange }: SetupServiceProps): React.JSX.Element {
	const Icon = ICONS[service.id];
	const title = service.id === 'assistant' ? 'LLM Model' : service.title;
	const modelId = service.id === 'assistant' && state.providerId === 'ollama'
		? (state.localModelId ?? state.modelId)
		: state.modelId;
	return (
		<Item data-testid={`setup-${service.id}`} variant="outline" size="md" className="flex-nowrap gap-3 rounded-2xl border-b border-border/60 px-3 py-2 last:border-b-0">
			<ItemMedia variant="icon" className="size-10 rounded-2xl bg-muted/50">
				<Icon className="size-5" aria-hidden="true" />
			</ItemMedia>
			<ItemContent className="min-w-0 flex-col items-start gap-0.5">
				<ItemTitle className="min-w-0 max-w-full truncate text-sm leading-tight">{title}</ItemTitle>
				<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">{service.description}</p>
			</ItemContent>
			<ItemActions className="ml-auto flex-none justify-end">
				<ModelProviderSelect
					inline
					buttonDropdown
					buttonClassName="w-40 min-w-0"
					idPrefix={`setup-${service.id}`}
					providerGroups={toModelProviderGroups(state.modelGroups)}
					providerId={state.providerId}
					modelId={modelId}
					disabled={disabled || state.modelGroups.length === 0}
					showFieldLabel={false}
					labels={{ label: title, placeholder: 'Select a model' }}
					onChange={(providerId, selectedModelId) => onChange(service.id, providerId, selectedModelId)}
				/>
			</ItemActions>
		</Item>
	);
}
