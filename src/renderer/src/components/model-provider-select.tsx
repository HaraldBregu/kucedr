import React, { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Search } from 'lucide-react';
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
import type { ModelReasoningEffort } from '@shared/agent_types';

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

interface ModelProviderSelectProps {
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
	readonly effortLevels?: readonly ModelReasoningEffort[];
	readonly effort?: ModelReasoningEffort;
	readonly onEffortChange?: (effort?: ModelReasoningEffort) => void;
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
	compactPopover = false,
	buttonClassName,
	showFieldLabel = true,
	labels,
	effortLevels = [],
	effort,
	onEffortChange,
}: ModelProviderSelectProps): React.JSX.Element {
	const { t } = useTranslation();
	const [buttonOpen, setButtonOpen] = useState(false);
	const [modelSearch, setModelSearch] = useState('');
	const [activeProviderId, setActiveProviderId] = useState(providerId);
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
		(compactPopover && group.id !== activeProviderId ? [] : group.models)
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
				if (open) setActiveProviderId(providerId || providerGroups[0]?.id || '');
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
					{compactPopover &&
						selectedGroup &&
						(() => {
							const provider = getProviderCatalogItem(selectedGroup.id);
							const light = provider.iconLightUrl ?? provider.iconDarkUrl;
							const dark = provider.iconDarkUrl ?? provider.iconLightUrl;
							return light && dark ? (
								<span className="size-4 shrink-0">
									<img src={light} alt="" className="size-full object-contain dark:hidden" />
									<img src={dark} alt="" className="hidden size-full object-contain dark:block" />
								</span>
							) : null;
						})()}
					<span className="min-w-0 truncate capitalize">{buttonLabel}</span>
					<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				collisionPadding={12}
				className={cn(
					'flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-1',
					compactPopover && 'w-80 p-0'
				)}
			>
				{compactPopover && (
					<div className="flex shrink-0 overflow-x-auto border-b px-1" aria-label="Providers">
						{providerGroups
							.filter((group) => group.models.length > 0)
							.map((group) => {
								const provider = getProviderCatalogItem(group.id);
								const light = provider.iconLightUrl ?? provider.iconDarkUrl;
								const dark = provider.iconDarkUrl ?? provider.iconLightUrl;
								return (
									<button
										key={group.id}
										type="button"
										aria-label={providerName(group)}
										aria-pressed={activeProviderId === group.id}
										title={providerName(group)}
										onClick={() => setActiveProviderId(group.id)}
										className="relative flex size-10 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:bg-accent aria-pressed:text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full aria-pressed:after:bg-foreground"
									>
										{light && dark ? (
											<span className="size-5">
												<img src={light} alt="" className="size-full object-contain dark:hidden" />
												<img
													src={dark}
													alt=""
													className="hidden size-full object-contain dark:block"
												/>
											</span>
										) : (
											<span className="text-xs font-medium">
												{providerName(group).slice(0, 2).toUpperCase()}
											</span>
										)}
									</button>
								);
							})}
					</div>
				)}
				<div className={cn('relative shrink-0', compactPopover && 'border-b')}>
					{compactPopover && (
						<Search
							className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
					)}
					<Input
						aria-label={t('settings.modelServices.searchModels')}
						className={cn(
							'mb-1 h-8 shrink-0 text-xs focus-visible:outline-none! focus-visible:ring-0 focus-visible:ring-offset-0',
							compactPopover && 'mb-0 h-10 rounded-none border-0 bg-transparent pl-9 shadow-none'
						)}
						placeholder={t('settings.modelServices.searchModels')}
						value={modelSearch}
						onChange={(event) => setModelSearch(event.target.value)}
					/>
				</div>
				<div
					role="menu"
					aria-label={accessibleLabel}
					className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto', compactPopover && 'p-1')}
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
									setButtonOpen(false);
									setModelSearch('');
								}}
								className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent aria-checked:bg-accent aria-checked:text-accent-foreground"
							>
								<span className="flex min-w-0 flex-col items-start gap-0.5 leading-tight">
									<span className="min-w-0 truncate whitespace-nowrap text-sm text-foreground capitalize">
										{modelName(model)}
									</span>
									{!compactPopover && (
										<span className="min-w-0 truncate whitespace-nowrap text-xs text-muted-foreground capitalize">
											{providerName(group)}
										</span>
									)}
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
				{compactPopover && onEffortChange && (
					<div className="shrink-0 border-t px-3 py-3">
						<div className="mb-2 text-center text-xs font-medium capitalize text-foreground">
							{effortLevels.length ? (effort ?? 'Automatic') : 'Effort unavailable for this model'}
						</div>
						<input
							type="range"
							aria-label="Reasoning effort"
							aria-valuetext={effort ?? 'Automatic'}
							min={0}
							max={Math.max(1, effortLevels.length)}
							disabled={effortLevels.length === 0}
							step={1}
							value={effort ? Math.max(0, effortLevels.indexOf(effort) + 1) : 0}
							onChange={(event) => onEffortChange(effortLevels[Number(event.target.value) - 1])}
							className="h-2 w-full cursor-pointer accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
						/>
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
