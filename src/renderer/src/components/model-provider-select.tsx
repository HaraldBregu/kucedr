import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { providerIdsFor, providerModels } from '@/lib/providers';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { SettingsField } from '@pages/settings/components';
import { getProviderCatalogItem } from '@pages/start/setupConstants';

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
	showFieldLabel = true,
	labels,
}: ModelProviderSelectProps): React.JSX.Element {
	const { t } = useTranslation();
	const selectedGroup = providerGroups.find((group) => group.id === providerId);
	const selectedModel = selectedGroup?.models.find((model) => model.id === modelId);
	const selectedLabel = selectedModel ? modelLabel(providerId, selectedModel) : undefined;

	const select = (
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
				aria-label={
					inline || !showFieldLabel
						? (labels?.label ?? t('settings.modelServices.model'))
						: undefined
				}
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
