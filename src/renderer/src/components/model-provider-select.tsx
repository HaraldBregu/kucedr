import React, { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { providerIdsFor, providerModels } from '@/lib/providers';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { SettingsField } from '@pages/settings/components';
import { getProviderCatalogItem } from '@pages/start/setupConstants';
import { cn } from '@/lib/utils';

export interface ModelProviderGroup {
	readonly id: string;
	readonly models: readonly { readonly id: string; readonly name: string }[];
}

export function llmProviderGroups(): readonly ModelProviderGroup[] {
	return providerIdsFor('llm').map((id) => ({ id, models: providerModels(id, 'llm') }));
}

export function resolveStoredModelProvider(
	providerGroups: readonly ModelProviderGroup[],
	storedProviderId: string | null | undefined,
	storedModelId: string | null | undefined
): { providerId: string; modelId: string } {
	const group = providerGroups.find((item) => item.id === storedProviderId) ?? providerGroups[0];
	const model = group?.models.find((item) => item.id === storedModelId) ?? group?.models[0];
	return {
		providerId: group?.id ?? '',
		modelId: model?.id ?? '',
	};
}

export function toModelProviderGroups(
	groups: readonly {
		readonly provider: { readonly id: string };
		readonly models: readonly { readonly id: string; readonly name: string }[];
	}[]
): readonly ModelProviderGroup[] {
	return groups.map((group) => ({
		id: group.provider.id,
		models: group.models,
	}));
}

const VALUE_SEPARATOR = '\u001F';

function modelLabel(providerId: string, model: { id: string; name: string }): string {
	return `${getProviderCatalogItem(providerId).name} / ${model.name || model.id}`;
}

function modelName(model: { id: string; name: string }): string {
	return model.name || model.id;
}

interface ModelProviderSelectLabels {
	readonly label?: string;
	readonly placeholder?: string;
	readonly description?: ReactNode;
}

interface ModelProviderSelectProps {
	readonly idPrefix: string;
	readonly providerGroups: readonly ModelProviderGroup[];
	readonly providerId: string;
	readonly modelId: string;
	readonly onChange: (nextProviderId: string, nextModelId: string) => void;
	readonly disabled?: boolean;
	readonly inline?: boolean;
	readonly buttonDropdown?: boolean;
	readonly showFieldLabel?: boolean;
	readonly labels?: ModelProviderSelectLabels;
}

export function ModelProviderSelect({
	idPrefix,
	providerGroups,
	providerId,
	modelId,
	onChange,
	disabled = false,
	inline = false,
	buttonDropdown = false,
	showFieldLabel = true,
	labels,
}: ModelProviderSelectProps): React.JSX.Element {
	const { t } = useTranslation();
	const [buttonOpen, setButtonOpen] = useState(false);
	const selectedGroup = providerGroups.find((group) => group.id === providerId);
	const selectedModel = selectedGroup?.models.find((model) => model.id === modelId);
	const selectedLabel = selectedModel ? modelLabel(providerId, selectedModel) : undefined;
	const accessibleLabel = labels?.label ?? t('settings.modelServices.model');
	const buttonLabel = selectedModel
		? modelName(selectedModel)
		: (labels?.placeholder ?? t('settings.modelServices.modelPlaceholder'));

	const buttonSelect = (
		<Popover open={buttonOpen} onOpenChange={setButtonOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled || providerGroups.length === 0}
					aria-label={accessibleLabel}
					className="min-w-40 max-w-full justify-between text-xs"
				>
					<span className="min-w-0 truncate">{buttonLabel}</span>
					<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="max-h-[var(--radix-popover-content-available-height)] w-max max-w-[calc(100vw-2rem)] overflow-y-auto p-1"
			>
				<div role="menu" aria-label={accessibleLabel} className="min-w-0">
					{providerGroups.flatMap((group) =>
						group.models.map((model) => {
							const value = `${group.id}${VALUE_SEPARATOR}${model.id}`;
							const isSelected = value === `${providerId}${VALUE_SEPARATOR}${modelId}`;
							return (
								<button
									key={value}
									type="button"
									role="menuitemradio"
									aria-checked={isSelected}
									onClick={() => {
										onChange(group.id, model.id);
										setButtonOpen(false);
									}}
									className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
								>
									<span className="flex min-w-0 flex-col items-start">
										<span className="min-w-0 truncate whitespace-nowrap text-sm text-foreground">
											{modelName(model)}
										</span>
										<span className="min-w-0 truncate whitespace-nowrap text-xs text-muted-foreground">
											{getProviderCatalogItem(group.id).name}
										</span>
									</span>
									<Check
										className={cn('size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
										aria-hidden="true"
									/>
								</button>
							);
						})
					)}
				</div>
			</PopoverContent>
		</Popover>
	);

	const select = buttonDropdown ? (
		buttonSelect
	) : (
		<Select
			value={selectedModel ? `${providerId}${VALUE_SEPARATOR}${modelId}` : null}
			onValueChange={(value) => {
				if (!value) return;
				const [nextProviderId = '', nextModelId = ''] = value.split(VALUE_SEPARATOR);
				onChange(nextProviderId, nextModelId);
			}}
			disabled={disabled || providerGroups.length === 0}
		>
			<SelectTrigger
				id={`${idPrefix}-model`}
				className={inline ? 'w-40 max-w-full text-xs' : 'w-full min-w-0 max-w-full text-xs'}
				aria-label={inline || !showFieldLabel ? accessibleLabel : undefined}
			>
				<SelectValue
					className="min-w-0 overflow-hidden"
					placeholder={labels?.placeholder ?? t('settings.modelServices.modelPlaceholder')}
				>
					{selectedLabel}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{providerGroups.flatMap((group) =>
					group.models.map((model) => (
						<SelectItem
							key={`${group.id}${VALUE_SEPARATOR}${model.id}`}
							value={`${group.id}${VALUE_SEPARATOR}${model.id}`}
						>
							{modelLabel(group.id, model)}
						</SelectItem>
					))
				)}
			</SelectContent>
		</Select>
	);

	if (inline || !showFieldLabel) return select;

	return (
		<SettingsField
			id={`${idPrefix}-model`}
			label={labels?.label ?? t('settings.modelServices.model')}
			description={labels?.description}
		>
			{select}
		</SettingsField>
	);
}
