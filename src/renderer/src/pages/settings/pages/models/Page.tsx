import React, { useEffect, useState } from 'react';
import { AlertTriangle, Boxes } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProviderAvatar } from '@/components/provider-avatar';
import type { CatalogModel, ModelCapability } from '@shared/model_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';
import { SettingsFilter } from '../../components/filter';
import { loadModelCatalog } from './catalog';

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
	const navigate = useNavigate();
	const [models, setModels] = useState<readonly CatalogModel[] | null>(null);
	const [error, setError] = useState(false);
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState('all');
	const search = query.trim().toLocaleLowerCase();
	const visibleModels = models?.filter(
		(model) =>
			(category === 'all' || model.type === category) &&
			`${model.name} ${model.id} ${model.provider.name} ${model.provider.plugin?.name ?? ''}`
				.toLocaleLowerCase()
				.includes(search)
	);
	const categories = TYPES.filter((type) => models?.some((model) => model.type === type));
	const categoryLabels = Object.fromEntries(
		categories.map((type) => [type, t(`settings.models.types.${type}`)])
	);

	useEffect(() => {
		let active = true;
		let revision = 0;
		const load = async (): Promise<void> => {
			const current = ++revision;
			try {
				const nextModels = await loadModelCatalog();
				if (active && current === revision) {
					setModels(nextModels);
					setCategory((selected) =>
						selected === 'all' || nextModels.some((model) => model.type === selected)
							? selected
							: 'all'
					);
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
			<SettingsFilter
				query={query}
				onQueryChange={setQuery}
				categories={categories}
				category={category}
				onCategoryChange={setCategory}
				categoryLabels={categoryLabels}
			/>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{t('settings.models.loadError')}
				</SettingsNotice>
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
									<Card
										key={`${model.provider.id}/${model.id}`}
										size="sm"
										role="link"
										tabIndex={0}
										className="cursor-pointer transition-colors hover:bg-muted hover:ring-foreground/20 focus-visible:bg-muted focus-visible:ring-foreground/20"
										onClick={() =>
											navigate(
												`/settings/models/${encodeURIComponent(model.type)}/${encodeURIComponent(model.provider.id)}/${encodeURIComponent(model.id)}`
											)
										}
										onKeyDown={(event) => {
											if (
												event.target === event.currentTarget &&
												(event.key === 'Enter' || event.key === ' ')
											) {
												event.preventDefault();
												navigate(
													`/settings/models/${encodeURIComponent(model.type)}/${encodeURIComponent(model.provider.id)}/${encodeURIComponent(model.id)}`
												);
											}
										}}
									>
										<CardHeader className="flex flex-1 items-center gap-3">
											<ProviderAvatar
												providerId={model.provider.id}
												name={model.provider.name}
												iconDarkUrl={model.provider.iconDarkUrl}
												iconLightUrl={model.provider.iconLightUrl}
													className="size-12 rounded-xl border-0"
											/>
											<div className="flex min-w-0 flex-1 flex-col gap-1">
												<CardTitle className="break-words">{model.name}</CardTitle>
												<CardDescription className="break-words text-xs">
													{model.provider.name}
													{model.provider.plugin?.name !== model.provider.name &&
														` · ${model.provider.plugin?.name}`}
												</CardDescription>
											</div>
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
