import { useEffect, useState, type ReactElement } from 'react';
import { ModelProviderSelect, type ModelProviderGroup } from '@/components/model-provider-select';
import { providerIdsFor, providerModels, providers } from '@/lib/providers';

export function Model(): ReactElement {
	const [groups, setGroups] = useState<ModelProviderGroup[]>([]);
	const [providerId, setProviderId] = useState('');
	const [modelId, setModelId] = useState('');
	const [localProvider, setLocalProvider] =
		useState<Awaited<ReturnType<NonNullable<typeof window.provider>['list']>>[number]>();
	const [saving, setSaving] = useState(false);
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
				const catalogGroups = providerIdsFor('llm').map((id) => ({
					id,
					models: providerModels(id, 'llm'),
				}));
				if (custom) {
					const models = await window.provider
						.listCustomModels({ baseUrl: custom.baseUrl, apiKey: custom.apiKey })
						.catch(() => []);
					catalogGroups.push({
						id: 'ollama',
						models: models.map((id) => ({ id, name: id })),
					});
				}
				if (!active) return;
				setGroups(catalogGroups);
				setLocalProvider(custom);
				setProviderId(storedProvider?.id === 'custom' ? 'ollama' : (storedProvider?.id ?? ''));
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
			nextProviderId === 'ollama' && localProvider
				? { id: 'ollama', name: localProvider.name, baseUrl: localProvider.baseUrl }
				: providers().find((item) => item.id === nextProviderId);
		if (!provider) return;
		setSaving(true);
		setError(false);
		try {
			if (!(await window.agent.setProvider(provider))) throw new Error('Provider was not saved');
			if (!(await window.agent.setModelId(nextModelId))) throw new Error('Model was not saved');
			if (nextProviderId !== 'ollama') await window.agent.setModelOptions({});
			setProviderId(nextProviderId);
			setModelId(nextModelId);
		} catch {
			setError(true);
		} finally {
			setSaving(false);
		}
	};

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
				showFieldLabel={false}
				buttonClassName="h-6 min-w-0 max-w-48 rounded-[min(var(--radius-md),10px)] px-2 text-[11px] text-muted-foreground shadow-none hover:text-foreground"
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
