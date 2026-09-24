import React, { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Bot } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ModelProviderSelect, toModelProviderGroups } from '@/components/model-provider-select';
import { cn } from '@/lib/utils';
import { ProviderAvatar } from '@/components/provider-avatar';
import { getProviderCatalogItem } from '../../start/setupConstants';
import { SettingsAutoDismiss, SettingsLoadingRows, SettingsNotice, SettingsRow } from './index';
import type { ModelConfigurationState } from './model-configuration-state';
import type { LucideIcon } from 'lucide-react';

interface ModelProviderConfigurationProps {
	readonly configState: ModelConfigurationState;
	readonly idPrefix: string;
	readonly description?: ReactNode;
	readonly triggerTitle?: ReactNode;
	readonly triggerDescription?: ReactNode;
	readonly showInlineError?: boolean;
	readonly showIcon?: boolean;
	readonly icon?: LucideIcon;
	readonly pluginItemStyle?: boolean;
	readonly showFieldLabel?: boolean;
	readonly grouped?: boolean;
	readonly collapsible?: boolean;
	readonly padded?: boolean;
	readonly showSelectedModel?: boolean;
	readonly buttonDropdown?: boolean;
	readonly buttonClassName?: string;
	readonly showContentSeparator?: boolean;
	readonly defaultOpen?: boolean;
	readonly action?: ReactNode;
	readonly onChange: (nextProviderId: string, nextModelId: string) => void;
	readonly children?: ReactNode;
}

export function ModelProviderConfiguration({
	configState,
	idPrefix,
	description,
	triggerTitle,
	triggerDescription,
	showInlineError = false,
	showIcon = true,
	icon: FunctionIcon,
	pluginItemStyle = false,
	showFieldLabel = true,
	grouped = false,
	collapsible = true,
	padded = true,
	showSelectedModel = false,
	buttonDropdown = false,
	buttonClassName,
	showContentSeparator = true,
	defaultOpen = false,
	action,
	onChange,
	children,
}: ModelProviderConfigurationProps): React.JSX.Element {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const group = configState.modelGroups.find((item) => item.provider.id === configState.providerId);
	const provider = group?.provider;
	const model = group?.models.find((item) => item.id === configState.modelId);
	const providerName = provider
		? getProviderCatalogItem(provider.id).name
		: t('settings.modelServices.providerPlaceholder');
	const modelName = model?.name ?? model?.id ?? t('settings.modelServices.modelUnavailable');
	const selectLabel =
		typeof triggerTitle === 'string' ? triggerTitle : t('settings.modelServices.model');
	const modelSelectDisabled =
		configState.loading || configState.saving || configState.modelGroups.length === 0;
	const collapsibleModelSelect = (
		<ModelProviderSelect
			inline={showSelectedModel}
			buttonDropdown={buttonDropdown}
			buttonClassName={buttonClassName}
			idPrefix={idPrefix}
			providerGroups={toModelProviderGroups(configState.modelGroups)}
			providerId={configState.providerId}
			modelId={configState.modelId}
			onChange={onChange}
			disabled={modelSelectDisabled}
			showFieldLabel={showSelectedModel ? false : showFieldLabel}
			labels={{
				label: selectLabel,
				description,
				placeholder: configState.loadingModels
					? t('settings.modelServices.modelsLoading')
					: undefined,
			}}
		/>
	);

	const configurationBody = configState.loading ? (
		<SettingsLoadingRows rows={2} />
	) : (
		<div className="grid min-w-0 gap-3 px-4 py-4">
			{showInlineError && configState.error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{configState.error}
				</SettingsNotice>
			)}

			{!showSelectedModel && collapsibleModelSelect}

			{children}

			{configState.providers.length === 0 && (
				<p className="text-[11px] leading-4 text-muted-foreground">
					{t('settings.providers.noProviders')}
				</p>
			)}
			{configState.providers.length > 0 && configState.modelGroups.length === 0 && (
				<p className="text-[11px] leading-4 text-muted-foreground">
					{t('settings.modelServices.noModels')}
				</p>
			)}
			{configState.saved && (
				<SettingsAutoDismiss>
					<p className="text-[11px] leading-4 text-muted-foreground">
						{t('settings.modelServices.saved')}
					</p>
				</SettingsAutoDismiss>
			)}
		</div>
	);

	if (!collapsible) {
		const rowTitle = triggerTitle ?? providerName;
		return (
			<>
				{showInlineError && configState.error && (
					<SettingsNotice variant="destructive" icon={AlertTriangle} className="mx-3 mt-3">
						{configState.error}
					</SettingsNotice>
				)}
				<SettingsRow
					className={padded ? undefined : 'px-0 sm:px-0'}
					title={rowTitle}
					description={triggerDescription ?? description}
					media={
						showIcon &&
						(FunctionIcon ? (
							<FunctionIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						) : provider ? (
							<ProviderAvatar
								providerId={provider.id}
								name={providerName}
								iconDarkUrl={provider.iconDarkUrl}
								iconLightUrl={provider.iconLightUrl}
								className="size-5"
							/>
						) : undefined)
					}
					actions={
						<ModelProviderSelect
							inline
							buttonDropdown={buttonDropdown}
							buttonClassName={buttonClassName}
							idPrefix={idPrefix}
							providerGroups={toModelProviderGroups(configState.modelGroups)}
							providerId={configState.providerId}
							modelId={configState.modelId}
							onChange={onChange}
							disabled={
								configState.loading || configState.saving || configState.modelGroups.length === 0
							}
							labels={{
								label: selectLabel,
								placeholder: configState.loadingModels
									? t('settings.modelServices.modelsLoading')
									: undefined,
							}}
						/>
					}
				/>
				<div className={cn('pb-4 empty:hidden', padded && 'px-4')}>{children}</div>
				{configState.providers.length === 0 && (
					<p className={cn('pb-3 text-[11px] leading-4 text-muted-foreground', padded && 'px-4')}>
						{t('settings.providers.noProviders')}
					</p>
				)}
				{configState.providers.length > 0 && configState.modelGroups.length === 0 && (
					<p className={cn('pb-3 text-[11px] leading-4 text-muted-foreground', padded && 'px-4')}>
						{t('settings.modelServices.noModels')}
					</p>
				)}
				{configState.saved && (
					<SettingsAutoDismiss>
						<p className={cn('pb-3 text-[11px] leading-4 text-muted-foreground', padded && 'px-4')}>
							{t('settings.modelServices.saved')}
						</p>
					</SettingsAutoDismiss>
				)}
			</>
		);
	}

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={setIsOpen}
			className={
				grouped
					? 'min-w-0 max-w-full overflow-hidden border-b border-border/60 last:border-b-0'
					: 'min-w-0 max-w-full overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10'
			}
		>
			<div
				className={cn(
					'flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40',
					pluginItemStyle && 'rounded-2xl px-3 py-2'
				)}
			>
				<CollapsibleTrigger
					className={cn(
						'group flex min-w-0 flex-1 items-center gap-4 text-left',
						pluginItemStyle && 'gap-3'
					)}
				>
					{showIcon &&
						(FunctionIcon ? (
							pluginItemStyle ? (
								<div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
									<FunctionIcon className="size-5" aria-hidden="true" />
								</div>
							) : (
								<FunctionIcon
									className="size-5 shrink-0 text-muted-foreground"
									aria-hidden="true"
								/>
							)
						) : provider ? (
							<ProviderAvatar
								providerId={provider.id}
								name={providerName}
								iconDarkUrl={provider.iconDarkUrl}
								iconLightUrl={provider.iconLightUrl}
								className={pluginItemStyle ? 'size-10 rounded-2xl bg-muted/50 p-1' : 'size-10'}
							/>
						) : (
							<div
								className={cn(
									'flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground',
									pluginItemStyle && 'rounded-2xl border-0 bg-muted/50'
								)}
							>
								<Bot className="size-4" aria-hidden="true" />
							</div>
						))}
					<div className="min-w-0 flex-1">
						<div
							className={cn(
								'truncate text-[13px] font-medium leading-4 text-foreground',
								pluginItemStyle && 'text-sm leading-tight'
							)}
						>
							{triggerTitle ?? providerName}
						</div>
						<p
							className={cn(
								'mt-0.5 truncate text-[11px] leading-4 text-muted-foreground',
								pluginItemStyle && 'text-xs leading-tight'
							)}
						>
							{triggerDescription ?? (showSelectedModel ? description : modelName)}
						</p>
					</div>
				</CollapsibleTrigger>
				{showSelectedModel && <div className="shrink-0">{collapsibleModelSelect}</div>}
				{action && (
					<div
						className="flex shrink-0 items-center gap-3"
						onClick={(event) => event.stopPropagation()}
					>
						{action}
					</div>
				)}
			</div>
			<CollapsibleContent
				className={showContentSeparator ? 'border-t border-border/60' : undefined}
			>
				{configurationBody}
			</CollapsibleContent>
		</Collapsible>
	);
}
