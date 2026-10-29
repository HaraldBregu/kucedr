import React, { type ReactNode, useState } from 'react';
import type { ModelReasoningEffort } from '@/lib/compat';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { providerIdsFor, providerModels } from '@/lib/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
	readonly name?: string;
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
		readonly provider: { readonly id: string; readonly name: string };
		readonly models: readonly { readonly id: string; readonly name: string }[];
	}[]
): readonly ModelProviderGroup[] {
	return groups.map((group) => ({
		id: group.provider.id,
		name: group.provider.name,
		models: group.models,
	}));
}

const VALUE_SEPARATOR = '\u001F';

function providerName(group: ModelProviderGroup): string {
	return group.name ?? getProviderCatalogItem(group.id).name;
}

function modelLabel(group: ModelProviderGroup, model: { id: string; name: string }): string {
	return `${providerName(group)} / ${model.name || model.id}`;
}

function modelName(model: { id: string; name: string }): string {
	return model.name || model.id;
}

interface ModelProviderSelectLabels {
	readonly label?: string;
	readonly placeholder?: string;
	readonly description?: ReactNode;
}

const EFFORTS = ['auto', 'none', 'low', 'medium', 'high'] as const;

interface ModelProviderSelectProps {
	readonly effort?: ModelReasoningEffort | 'auto';
	readonly onEffortChange?: (effort: ModelReasoningEffort | 'auto') => void;
	readonly idPrefix: string;
	readonly providerGroups: readonly ModelProviderGroup[];
	readonly providerId: string;
	readonly modelId: string;
	readonly onChange: (nextProviderId: string, nextModelId: string) => void;
	readonly disabled?: boolean;
	readonly inline?: boolean;
	readonly buttonDropdown?: boolean;
	readonly compactPopover?: boolean;
	readonly buttonClassName?: string;
	readonly showFieldLabel?: boolean;
	readonly labels?: ModelProviderSelectLabels;
}

export function ModelProviderSelect({
	idPrefix,
	effort,
	onEffortChange,
	providerGroups,
	providerId,
	modelId,
	onChange,
	disabled = false,
	inline = false,
	buttonDropdown = false,
	compactPopover = false,
	buttonClassName,
	showFieldLabel = true,
	labels,
}: ModelProviderSelectProps): React.JSX.Element {
	const { t } = useTranslation();
	const [buttonOpen, setButtonOpen] = useState(false);
	const [modelSearch, setModelSearch] = useState('');
	const selectedGroup = providerGroups.find((group) => group.id === providerId);
	const selectedModel = selectedGroup?.models.find((model) => model.id === modelId);
	const selectedLabel =
		selectedModel && selectedGroup ? modelLabel(selectedGroup, selectedModel) : undefined;
	const accessibleLabel = labels?.label ?? t('settings.modelServices.model');
	const buttonLabel = selectedModel
		? compactPopover
			? modelName(selectedModel).replace(/\s+high$/i, '')
			: modelName(selectedModel)
		: (labels?.placeholder ?? t('settings.modelServices.modelPlaceholder'));
	const normalizedModelSearch = modelSearch.trim().toLocaleLowerCase();
	const matchingModels = providerGroups.flatMap((group) =>
		group.models
			.filter((model) => {
				if (!normalizedModelSearch) return true;
				return [model.id, model.name, providerName(group)].some((value) =>
					value.toLocaleLowerCase().includes(normalizedModelSearch)
				);
			})
			.map((model) => ({ group, model }))
	);

	const buttonSelect = (
		<Popover
			open={buttonOpen}
			onOpenChange={(open) => {
				setButtonOpen(open);
				if (!open) setModelSearch('');
			}}
		>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant={compactPopover ? 'ghost' : 'outline'}
					size="sm"
					disabled={disabled || providerGroups.length === 0}
					aria-label={accessibleLabel}
					className={cn('min-w-40 max-w-full justify-between text-xs', buttonClassName)}
				>
					<span className="min-w-0 truncate capitalize">{buttonLabel}</span>
					{effort && <span className="text-xs capitalize text-muted-foreground">{effort}</span>}
					<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				collisionPadding={12}
				className="flex max-h-[var(--radix-popover-content-available-height)] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-1"
			>
				<Input
					aria-label={t('settings.modelServices.searchModels')}
					className="mb-1 h-8 shrink-0 text-xs focus-visible:outline-none! focus-visible:ring-0 focus-visible:ring-offset-0"
					placeholder={t('settings.modelServices.searchModels')}
					value={modelSearch}
					onChange={(event) => setModelSearch(event.target.value)}
				/>
				<div
					role="menu"
					aria-label={accessibleLabel}
					className="max-h-[calc(var(--radix-popover-content-available-height)-2.5rem)] min-h-0 min-w-0 overflow-y-auto"
				>
					{matchingModels.map(({ group, model }) => {
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
									if (!onEffortChange) setButtonOpen(false);
									setModelSearch('');
								}}
								className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent aria-checked:bg-accent aria-checked:text-accent-foreground"
							>
								<span className="flex min-w-0 flex-col items-start gap-0.5 leading-tight">
									<span className="min-w-0 truncate whitespace-nowrap text-sm text-foreground capitalize">
										{modelName(model)}
									</span>
									<span className="min-w-0 truncate whitespace-nowrap text-xs text-muted-foreground capitalize">
										{providerName(group)}
									</span>
								</span>
								<Check
									className={cn('size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
									aria-hidden="true"
								/>
							</button>
						);
					})}
					{matchingModels.length === 0 && (
						<p className="px-2 py-3 text-xs text-muted-foreground">
							{t('settings.modelServices.noMatchingModels')}
						</p>
					)}
				</div>
				{onEffortChange && effort && (
					<div className="mx-1.5 border-t border-border px-0.5 pb-2 pt-3">
						<div className="mb-2 flex justify-between text-xs"><span className="font-medium">Effort</span><span className="text-muted-foreground">← → to adjust</span></div>
						<div role="radiogroup" aria-label="Effort" className="flex rounded-lg bg-muted p-0.5">
							{EFFORTS.map((level, index) => (
								<button key={level} type="button" role="radio" aria-checked={effort === level} tabIndex={effort === level ? 0 : -1} onClick={() => onEffortChange(level)} onKeyDown={(event) => {
									if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
									event.preventDefault();
									const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + EFFORTS.length) % EFFORTS.length;
									onEffortChange(EFFORTS[next]);
									(event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
								}} className={cn('flex-1 rounded-md py-1.5 text-xs capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring', effort === level ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{level}</button>
							))}
						</div>
						<p className="mt-2 text-xs text-muted-foreground">{effort === 'auto' ? 'Adjusts reasoning to the prompt.' : effort === 'none' ? 'Fast answers with minimal reasoning.' : effort === 'low' ? 'A little reasoning for quick tasks.' : effort === 'medium' ? 'More reasoning for everyday work.' : 'More time for complex work.'}</p>
					</div>
				)}
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
				className={`${inline ? 'w-80' : 'w-full'} min-w-0 max-w-full whitespace-normal text-xs data-[size=default]:h-auto data-[size=default]:min-h-8 *:data-[slot=select-value]:line-clamp-none`}
				aria-label={inline || !showFieldLabel ? accessibleLabel : undefined}
			>
				<SelectValue
					className="min-w-0 whitespace-normal break-words capitalize"
					placeholder={labels?.placeholder ?? t('settings.modelServices.modelPlaceholder')}
				>
					{selectedLabel}
				</SelectValue>
			</SelectTrigger>
			<SelectContent className="max-w-[var(--available-width)]">
				{providerGroups.flatMap((group) =>
					group.models.map((model) => (
						<SelectItem
							className="capitalize [&>span]:min-w-0 [&>span]:shrink [&>span]:whitespace-normal [&>span]:break-words"
							key={`${group.id}${VALUE_SEPARATOR}${model.id}`}
							value={`${group.id}${VALUE_SEPARATOR}${model.id}`}
						>
							{modelLabel(group, model)}
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
