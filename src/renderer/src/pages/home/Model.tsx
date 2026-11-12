import { useEffect, useState, type ReactElement } from 'react';
import { ModelProviderSelect } from '@/components/model-provider-select';
import { cn } from '@/lib/utils';
import { liveProviderModels, providerIdsFor, providerModels, providers } from '@/lib/providers';
import { modelContextWindow } from '@shared/model_context';
import { modelEfforts } from '@shared/effort';
import type { ModelReasoningEffort } from '@shared/agent_types';
import { readEffort } from './effort/read';
import { saveEffort } from './effort/save';
import type { ProviderModel } from '@shared/model_types';

export function Model({
	onContext,
	workspace = false,
	compact = false,
}: {
	workspace?: boolean;
	compact?: boolean;
	onContext?: (context: { providerId: string; modelId: string; contextWindow?: number }) => void;
}): ReactElement {
	const [groups, setGroups] = useState<{ id: string; discoveryLabel?: string; models: ProviderModel[] }[]>([]);
	const [providerId, setProviderId] = useState('');
	const [modelId, setModelId] = useState('');
	const [effort, setEffort] = useState<ModelReasoningEffort>();
	const [localProvider, setLocalProvider] =
		useState<Awaited<ReturnType<NonNullable<typeof window.provider>['list']>>[number]>();
	const [saving, setSaving] = useState(false);
	const [localContextWindow, setLocalContextWindow] = useState<number>();
	useEffect(() => {
		let active = true;
		setLocalContextWindow(undefined);
		if (providerId === 'custom')
			void window.agent
				.getContextWindow()
				.then((value) => {
					if (active && value.modelId === modelId && value.providerId === 'custom')
						setLocalContextWindow(value.contextWindow);
				})
				.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [providerId, modelId]);
	const [error, setError] = useState(false);

	useEffect(() => {
		let active = true;
		const refresh = async (): Promise<void> => {
			try {
				const [selection, configuredProviders] = await Promise.all([
					workspace ? window.app.getWorkspaceModel() : Promise.all([window.agent.getProvider(), window.agent.getModelId()]).then(([provider, modelId]) => ({ providerId: provider?.id ?? '', modelId: modelId ?? '' })),
					window.provider?.list('models').catch(() => []) ?? Promise.resolve([]),
				]);
				const custom = configuredProviders.find((provider) => provider.id === 'custom');
				const groupIds = [
					...new Set([
						...providerIdsFor('llm'),
						...providers()
							.filter((provider) => provider.modelsUrl)
							.map((provider) => provider.id),
					]),
				];
				const discoveryLabel = (id: string): string | undefined =>
					providers().find((provider) => provider.id === id)?.discoveryLabel;
				if (!active) return;
				setGroups((current) =>
					current.length > 0
						? current
						: groupIds.map((id) => ({ id, discoveryLabel: discoveryLabel(id), models: providerModels(id, 'llm') }))
				);
				setProviderId(selection.providerId);
				setModelId(selection.modelId);
				setEffort(readEffort(selection.providerId, selection.modelId));
				const catalogGroups = await Promise.all(
					groupIds.map(async (id) => ({
						id,
						discoveryLabel: discoveryLabel(id),
						models: await liveProviderModels(id, providerModels(id, 'llm')),
					}))
				);
				if (custom) {
					const models = await window.provider
						.listCustomModels({ baseUrl: custom.baseUrl, apiKey: custom.apiKey })
						.catch(() => []);
					catalogGroups.push({
						id: 'custom',
						discoveryLabel: undefined,
						models: models.map((id) => ({ id, name: id })),
					});
				}
				if (!active) return;
				setGroups(catalogGroups);
				setLocalProvider(custom);
				setProviderId(selection.providerId);
				setModelId(selection.modelId);
				setEffort(readEffort(selection.providerId, selection.modelId));
			} catch {
				if (active) setError(true);
			}
		};
		void refresh();
		const unsubscribe = window.app.onModelsChanged(() => void refresh());
		return () => {
			active = false;
			unsubscribe();
		};
	}, [workspace]);

	const changeModel = async (nextProviderId: string, nextModelId: string): Promise<void> => {
		const provider =
			nextProviderId === 'custom' && localProvider
				? { id: 'custom', name: localProvider.name, baseUrl: localProvider.baseUrl }
				: providers().find((item) => item.id === nextProviderId);
		if (!provider) return;
		setSaving(true);
		setError(false);
		try {
			if (workspace) await window.app.setWorkspaceModel({ providerId: nextProviderId, modelId: nextModelId });
			else {
				if (!(await window.agent.setProvider(provider))) throw new Error('Provider was not saved');
				if (!(await window.agent.setModelId(nextModelId))) throw new Error('Model was not saved');
				if (nextProviderId !== 'custom') await window.agent.setModelOptions({});
			}
			setProviderId(nextProviderId);
			setModelId(nextModelId);
			setEffort(readEffort(nextProviderId, nextModelId));
		} catch {
			setError(true);
		} finally {
			setSaving(false);
		}
	};

	const selectedModel = groups
		.find((group) => group.id === providerId)
		?.models.find((model) => model.id === modelId);
	const effortLevels = modelEfforts(selectedModel?.metadata);
	const selectedEffort = effort && effortLevels.includes(effort) ? effort : undefined;

	const contextWindow =
		localContextWindow ??
		modelContextWindow(
			groups.find((group) => group.id === providerId)?.models.find((model) => model.id === modelId)
				?.metadata
		);
	useEffect(() => {
		onContext?.({ providerId, modelId, contextWindow });
	}, [onContext, providerId, modelId, contextWindow]);

	return (
		<div className="flex min-w-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
			<ModelProviderSelect
				idPrefix="home"
				providerGroups={groups}
				providerId={providerId}
				modelId={modelId}
				onChange={(nextProviderId, nextModelId) => void changeModel(nextProviderId, nextModelId)}
				disabled={saving || groups.length === 0}
				inline
				buttonDropdown
				compactPopover
				nameOnly={compact}
				effortLevels={effortLevels}
				effort={selectedEffort}
				onEffortChange={(nextEffort) => {
					try {
						saveEffort(providerId, modelId, nextEffort);
						setEffort(nextEffort);
					} catch {
						setError(true);
					}
				}}
				showFieldLabel={false}
				buttonClassName={cn(
					'h-9 min-w-0 max-w-48 rounded-full px-2 text-sm text-foreground shadow-none hover:text-foreground',
					compact && 'h-7 rounded-md text-xs dark:hover:bg-accent'
				)}
				labels={{ label: 'Change model' }}
			/>
			{error ? (
				<span role="alert" className="text-[11px] text-destructive">
					Model unavailable
				</span>
			) : null}
		</div>
	);
}
