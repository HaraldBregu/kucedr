import React, { useEffect, useState } from 'react';
import { Boxes, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CatalogModel, ModelCapability } from '@shared/model_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';

const TYPES: readonly ModelCapability[] = [
	'text-to-image',
	'text-to-video',
	'text-to-audio',
	'text-to-speech',
	'speech-to-text',
	'realtime-voice',
	'embedding',
	'llm',
	'research-chat',
];

export default function ModelsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [models, setModels] = useState<readonly CatalogModel[] | null>(null);
	const [error, setError] = useState(false);
	const [query, setQuery] = useState('');
	const search = query.trim().toLocaleLowerCase();
	const visibleModels = models?.filter((model) =>
		`${model.name} ${model.id} ${model.provider.name} ${model.provider.plugin?.name ?? ''}`
			.toLocaleLowerCase()
			.includes(search)
	);

	useEffect(() => {
		let active = true;
		let revision = 0;
		const load = async (): Promise<void> => {
			const current = ++revision;
			try {
				const [catalog, providers] = await Promise.all([
					window.app.models(),
					window.provider.getModelProviders(),
				]);
				const live = await Promise.all(
					providers
						.filter((provider) => provider.plugin && provider.modelsUrl)
						.map(async (provider) =>
							(await window.provider.listModels(provider.id).catch(() => [])).map(
								(model): CatalogModel => ({
									...model,
									type: 'llm',
									location: 'remote',
									provider,
								})
							)
						)
				);
				const pluginModels = catalog.filter((model) => model.provider.plugin);
				const ids = new Set(pluginModels.map((model) => `${model.provider.id}/${model.id}`));
				if (active && current === revision) {
					setModels([
						...pluginModels,
						...live.flat().filter((model) => !ids.has(`${model.provider.id}/${model.id}`)),
					]);
					setError(false);
				}
			} catch {
				if (active && current === revision) setError(true);
			}
		};
		void load();
		const unsubscribe = window.app.onModelsChanged(() => void load());
		return () => {
			active = false;
			unsubscribe();
		};
	}, []);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.models')}
				description={t('settings.overview.descriptions.models')}
			/>
			<div className="relative mb-3">
				<Search
					className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					type="search"
					className="h-8 pl-8"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t('settings.modelServices.searchModels')}
					aria-label={t('settings.modelServices.searchModels')}
				/>
			</div>
			{error && (
				<SettingsNotice variant="destructive">{t('settings.models.loadError')}</SettingsNotice>
			)}
			{models === null && !error && (
				<SettingsPanel>
					<SettingsLoadingRows rows={2} />
				</SettingsPanel>
			)}
			{models?.length === 0 && !error && (
				<SettingsEmptyState icon={Boxes} title={t('settings.models.empty')} />
			)}
			{models && models.length > 0 && visibleModels?.length === 0 && !error && (
				<SettingsEmptyState title={t('settings.modelServices.noMatchingModels')} />
			)}
			<div className="space-y-6 pb-4">
				{TYPES.map((type) => {
					const group = visibleModels?.filter((model) => model.type === type) ?? [];
					if (group.length === 0) return null;
					return (
						<section key={type} aria-labelledby={`models-${type}`}>
							<h2 id={`models-${type}`} className="mb-3 text-base font-semibold">
								{t(`settings.models.types.${type}`)}
							</h2>
							<div className="grid grid-cols-1 gap-3">
								{group.map((model) => (
									<Card key={`${model.provider.id}/${model.id}`} size="sm">
										<CardHeader>
											<CardTitle className="break-words">{model.name}</CardTitle>
											<CardDescription className="break-words text-xs">
												{model.provider.name}
												{model.provider.plugin?.name !== model.provider.name &&
													` · ${model.provider.plugin?.name}`}
											</CardDescription>
										</CardHeader>
									</Card>
								))}
							</div>
						</section>
					);
				})}
			</div>
		</SettingsPageShell>
	);
}
