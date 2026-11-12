import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Boxes } from 'lucide-react';
import { ProviderAvatar } from '@/components/provider-avatar';
import type { CatalogModel } from '@shared/model_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';
import { loadModelCatalog } from './catalog';

export default function ModelDetail(): React.JSX.Element {
	const { t } = useTranslation();
	const { type, providerId, modelId } = useParams();
	const [model, setModel] = useState<CatalogModel | null | undefined>();
	const [error, setError] = useState(false);
	useEffect(() => {
		let active = true;
		setModel(undefined);
		setError(false);
		void loadModelCatalog().then(
			(models) => {
				if (active)
					setModel(
						models.find(
							(item) => item.type === type && item.provider.id === providerId && item.id === modelId
						) ?? null
					);
			},
			() => {
				if (active) {
					setError(true);
					setModel(null);
				}
			}
		);
		return () => {
			active = false;
		};
	}, [type, providerId, modelId]);

	if (model === undefined)
		return (
			<SettingsPageShell>
				<SettingsPanel>
					<SettingsLoadingRows rows={3} />
				</SettingsPanel>
			</SettingsPageShell>
		);
	if (!model)
		return (
			<SettingsPageShell>
				{error && (
					<SettingsNotice variant="destructive" icon={AlertTriangle}>
						{t('settings.models.loadError')}
					</SettingsNotice>
				)}
				<SettingsEmptyState icon={Boxes} title={t('settings.models.notFound')} />
			</SettingsPageShell>
		);

	const metadata = model.metadata;
	const rows: [string, string | number | boolean | undefined][] = [
		[t('settings.models.details.id'), model.id],
		[t('settings.models.details.description'), metadata?.description],
		[t('settings.models.details.type'), t(`settings.models.types.${model.type}`)],
		[t('settings.models.details.provider'), model.provider.name],
		[t('settings.models.details.plugin'), model.provider.plugin?.name],
		[t('settings.models.details.location'), model.location],
		[t('settings.models.details.authentication'), model.authentication],
		[t('settings.models.details.endpoint'), model.url],
		[t('settings.models.details.providerEndpoint'), model.provider.baseUrl],
		[t('settings.models.details.apiTypes'), model.apiTypes?.join(', ')],
		[t('settings.models.details.realtime'), model.realtime],
		[t('settings.models.details.sampleRate'), model.sampleRate],
		[t('settings.models.details.default'), model.default],
		[t('settings.models.details.contextWindow'), metadata?.contextWindow],
		[t('settings.models.details.maxInputTokens'), metadata?.maxInputTokens],
		[t('settings.models.details.defaultOutputTokens'), metadata?.defaultOutputTokens],
		[t('settings.models.details.documentationStatus'), metadata?.documentationStatus],
	];
	const links = [
		[t('settings.models.details.documentation'), metadata?.documentationUrl],
		[t('settings.models.details.contextDocumentation'), metadata?.contextWindowDocumentationUrl],
	] as const;

	return (
		<SettingsPageShell>
			<header className="mb-6 flex items-start gap-4 py-2">
				<ProviderAvatar
					providerId={model.provider.id}
					name={model.provider.name}
					iconDarkUrl={model.provider.iconDarkUrl}
					iconLightUrl={model.provider.iconLightUrl}
					className="size-16 rounded-2xl"
				/>
				<div className="min-w-0">
					<h1 className="break-words text-3xl font-normal leading-9">{model.name}</h1>
					<p className="mt-1.5 text-base text-muted-foreground">{model.provider.name}</p>
				</div>
			</header>
			<div className="flex flex-col gap-8 pb-8">
				<SettingsSection title={t('settings.models.details.title')}>
					<SettingsPanel>
						<dl className="divide-y divide-border">
							{rows
								.filter(([, value]) => value !== undefined && value !== '')
								.map(([label, value]) => (
									<div
										key={label}
										className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]"
									>
										<dt className="text-muted-foreground">{label}</dt>
										<dd className="break-all">
											{typeof value === 'boolean' ? t(value ? 'common.yes' : 'common.no') : value}
										</dd>
									</div>
								))}
							{links
								.filter(([, url]) => url)
								.map(([label, url]) => (
									<div
										key={label}
										className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]"
									>
										<dt className="text-muted-foreground">{label}</dt>
										<dd>
											<button
												type="button"
												className="break-all text-left underline"
												onClick={() => void window.app.openExternalUrl(url!)}
											>
												{url}
											</button>
										</dd>
									</div>
								))}
						</dl>
					</SettingsPanel>
				</SettingsSection>
				{metadata?.operations && Object.keys(metadata.operations).length > 0 && (
					<SettingsSection title={t('settings.models.details.operations')}>
						<SettingsPanel>
							<dl className="divide-y divide-border">
								{Object.entries(metadata.operations).map(([name, operation]) => (
									<div key={name} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
										<dt className="font-medium">{name}</dt>
										<dd className="min-w-0 space-y-1">
											<p>{operation.description}</p>
											<p className="break-all text-muted-foreground">{operation.endpoint}</p>
										</dd>
									</div>
								))}
							</dl>
						</SettingsPanel>
					</SettingsSection>
				)}
				{metadata?.promptAttachments && metadata.promptAttachments.length > 0 && (
					<SettingsSection title={t('settings.models.details.attachments')}>
						<SettingsPanel>
							<pre className="overflow-x-auto whitespace-pre-wrap break-words p-4 text-xs">
								{JSON.stringify(metadata.promptAttachments, null, 2)}
							</pre>
						</SettingsPanel>
					</SettingsSection>
				)}
				{metadata && Object.keys(metadata.inputs).length > 0 && (
					<SettingsSection title={t('settings.models.details.inputs')}>
						<SettingsPanel>
							<pre className="overflow-x-auto whitespace-pre-wrap break-words p-4 text-xs">
								{JSON.stringify(metadata.inputs, null, 2)}
							</pre>
						</SettingsPanel>
					</SettingsSection>
				)}
			</div>
		</SettingsPageShell>
	);
}
