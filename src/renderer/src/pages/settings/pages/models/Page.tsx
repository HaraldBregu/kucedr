import React, { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
	'llm',
	'research-chat',
	'text-to-image',
	'text-to-video',
	'text-to-audio',
	'text-to-speech',
	'speech-to-text',
	'realtime-voice',
	'embedding',
];

export default function ModelsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [models, setModels] = useState<readonly CatalogModel[] | null>(null);
	const [error, setError] = useState(false);

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
			<div className="grid grid-cols-1 items-start gap-3 pb-4 md:grid-cols-2">
				{TYPES.map((type) => {
					const group = models?.filter((model) => model.type === type) ?? [];
					if (group.length === 0) return null;
					return (
						<Card key={type} size="sm">
							<CardHeader>
								<CardTitle>{t(`settings.integrations.plugin.capabilities.${type}`)}</CardTitle>
							</CardHeader>
							<CardContent>
								<ul className="max-h-64 divide-y divide-border overflow-y-auto" tabIndex={0}>
									{group.map((model) => (
										<li
											key={`${model.provider.id}/${model.id}`}
											className="py-2 first:pt-0 last:pb-0"
										>
											<div className="break-words font-medium">{model.name}</div>
											<div className="break-words text-xs text-muted-foreground">
												{model.provider.name}
												{model.provider.plugin?.name !== model.provider.name &&
											` · ${model.provider.plugin?.name}`}
											</div>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</SettingsPageShell>
	);
}
