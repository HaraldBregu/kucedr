import { useEffect, useState, type ReactElement } from 'react';
import { ModelProviderSelect } from '@/components/model-provider-select';
import { liveProviderModels, providerIdsFor, providerModels, providers } from '@/lib/providers';
import { modelContextWindow } from '@shared/model_context';
import type { ProviderModel } from '@shared/model_types';
import { welcomeMessage } from './context';
import type { HomeChatMessage } from './context/state';
import { Usage } from './Usage';
import type { ModelReasoningEffort } from '@/lib/compat';

export function Model({
	messages = [],
	draft = '',
	hasAttachments = false,
	onContext,
	effort,
	onEffortChange,
}: {
	effort: ModelReasoningEffort | 'auto';
	onEffortChange: (effort: ModelReasoningEffort | 'auto') => void;
	messages?: readonly HomeChatMessage[];
	draft?: string;
	hasAttachments?: boolean;
	onContext?: (context: { providerId: string; modelId: string; contextWindow?: number }) => void;
}): ReactElement {
	const [groups, setGroups] = useState<{ id: string; models: ProviderModel[] }[]>([]);
	const [providerId, setProviderId] = useState('');
	const [modelId, setModelId] = useState('');
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
					if (
						active &&
						value.modelId === modelId &&
						value.providerId === 'custom'
					)
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
				const [storedProvider, storedModelId, configuredProviders] = await Promise.all([
					window.agent.getProvider(),
					window.agent.getModelId(),
					window.provider?.list('models').catch(() => []) ?? Promise.resolve([]),
				]);
				const custom = configuredProviders.find((provider) => provider.id === 'custom');
				const catalogGroups = await Promise.all(
					providerIdsFor('llm').map(async (id) => ({
						id,
						models: await liveProviderModels(id, providerModels(id, 'llm')),
					}))
				);
				if (custom) {
					const models = await window.provider
						.listCustomModels({ baseUrl: custom.baseUrl, apiKey: custom.apiKey })
						.catch(() => []);
					catalogGroups.push({
						id: 'custom',
						models: models.map((id) => ({ id, name: id })),
					});
				}
				if (!active) return;
				setGroups(catalogGroups);
				setLocalProvider(custom);
				setProviderId(storedProvider?.id ?? '');
				setModelId(storedModelId ?? '');
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
	}, []);

	const changeModel = async (nextProviderId: string, nextModelId: string): Promise<void> => {
		const provider =
			nextProviderId === 'custom' && localProvider
				? { id: 'custom', name: localProvider.name, baseUrl: localProvider.baseUrl }
				: providers().find((item) => item.id === nextProviderId);
		if (!provider) return;
		setSaving(true);
		setError(false);
		try {
			if (!(await window.agent.setProvider(provider))) throw new Error('Provider was not saved');
			if (!(await window.agent.setModelId(nextModelId))) throw new Error('Model was not saved');
			if (nextProviderId !== 'custom') await window.agent.setModelOptions({});
			setProviderId(nextProviderId);
			setModelId(nextModelId);
		} catch {
			setError(true);
		} finally {
			setSaving(false);
		}
	};

	const contextWindow =
		localContextWindow ??
		modelContextWindow(
			groups
				.find((group) => group.id === providerId)
				?.models.find((model) => model.id === modelId)?.metadata
		);
	useEffect(() => {
		onContext?.({ providerId, modelId, contextWindow });
	}, [onContext, providerId, modelId, contextWindow]);

	return (
		<div className="flex min-w-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
			<ModelProviderSelect
				effort={effort}
				onEffortChange={onEffortChange}
				idPrefix="home"
				providerGroups={groups}
				providerId={providerId}
				modelId={modelId}
				onChange={(nextProviderId, nextModelId) => void changeModel(nextProviderId, nextModelId)}
				disabled={saving || groups.length === 0}
				inline
				buttonDropdown
				compactPopover
				showFieldLabel={false}
				buttonClassName="h-9 min-w-0 max-w-48 rounded-full px-2 text-sm text-foreground shadow-none hover:text-foreground"
				labels={{ label: 'Change model' }}
			/>
			{modelId && messages.some((message) => message.id !== welcomeMessage.id) ? (
				<Usage
					providerId={providerId}
					modelId={modelId}
					contextWindow={contextWindow}
					messages={messages}
					draft={draft}
					hasAttachments={hasAttachments}
				/>
			) : null}
			{error ? (
				<span role="alert" className="text-[11px] text-destructive">
					Model unavailable
				</span>
			) : null}
		</div>
	);
}
