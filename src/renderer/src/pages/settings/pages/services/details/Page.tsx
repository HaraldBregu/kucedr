import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Globe, Layers, LoaderCircle, Plug, ServerCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CatalogWebSearch } from '@shared/provider_types';
import type { SearchEngineId, SearchSettings } from '@shared/search_types';
import { getErrorMessage } from '../../../../start/setupConstants';
import {
	SettingsEmptyState,
	SettingsField,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../../components';
import Meta from '../../plugins/Meta';

const ServiceDetailsPage: React.FC = () => {
	const { t } = useTranslation();
	const { serviceId } = useParams<{ serviceId: string }>();
	const id = decodeURIComponent(serviceId ?? '');
	const [service, setService] = useState<CatalogWebSearch | null | undefined>(undefined);
	const [settings, setSettings] = useState<SearchSettings | null>(null);
	const [apiKey, setApiKey] = useState('');
	const [saving, setSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');

	useEffect(() => {
		Promise.all([window.services.list(), window.search.getSettings()]).then(
			([list, searchSettings]) => {
				setService(list.find((item) => item.id === id) ?? null);
				setSettings(searchSettings);
			},
			() => {
				setErrorMessage(t('settings.services.loadError'));
				setService(null);
			}
		);
	}, [id, t]);

	if (service === undefined) {
		return (
			<SettingsPageShell>
				<SettingsPanel>
					<SettingsLoadingRows rows={3} />
				</SettingsPanel>
			</SettingsPageShell>
		);
	}

	if (!service) {
		return (
			<SettingsPageShell>
				{errorMessage && (
					<SettingsNotice variant="destructive" icon={AlertTriangle}>
						{errorMessage}
					</SettingsNotice>
				)}
				<SettingsEmptyState
					icon={ServerCog}
					title={id || t('settings.services.empty')}
					description={t('settings.services.emptyDescription')}
				/>
			</SettingsPageShell>
		);
	}

	const engineId = service.provider.id as SearchEngineId;
	const configured = settings?.configured[engineId] ?? false;
	const run = (action: () => Promise<SearchSettings>): void => {
		setSaving(true);
		setErrorMessage('');
		action()
			.then((next) => {
				setSettings(next);
				setApiKey('');
			})
			.catch((err: unknown) =>
				setErrorMessage(getErrorMessage(err, t('settings.services.saveError')))
			)
			.finally(() => setSaving(false));
	};
	const details = [
		{ key: 'type', title: t('settings.services.type'), icon: Layers, value: service.type },
		{ key: 'endpoint', title: t('settings.services.endpoint'), icon: Globe, value: service.url },
		{
			key: 'plugin',
			title: t('settings.services.plugin'),
			icon: Plug,
			value: service.provider.plugin?.name ?? service.provider.name,
		},
	];

	return (
		<SettingsPageShell>
			<header className="mb-6 flex items-start gap-4 py-2">
				<div className="min-w-0 flex-1">
					<h1 className="text-3xl font-normal leading-9 text-foreground">{service.name}</h1>
					<p className="mt-1.5 max-w-2xl text-base leading-5 text-muted-foreground">
						{t(configured ? 'settings.providers.configured' : 'settings.providers.notConfigured')}
					</p>
					<Meta rows={details} />
				</div>
			</header>
			<div className="flex flex-col gap-8 pb-8">
				<SettingsSection title={t('settings.integrations.plugin.configuration')}>
					{errorMessage && (
						<SettingsNotice variant="destructive" icon={AlertTriangle}>
							{errorMessage}
						</SettingsNotice>
					)}
					<form
						className="grid gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							if (saving || !apiKey.trim()) return;
							run(() => window.search.saveEngine(engineId, { apiKey: apiKey.trim() }));
						}}
					>
						<SettingsField id="service-api-key" label={t('settings.services.apiKey')}>
							<Input
								id="service-api-key"
								type="password"
								autoComplete="off"
								spellCheck={false}
								disabled={saving}
								placeholder={
									configured ? '************' : t('settings.providers.apiKeyPlaceholder')
								}
								value={apiKey}
								onChange={(event) => setApiKey(event.target.value)}
							/>
						</SettingsField>
						<div className="flex justify-end gap-2">
							{configured && (
								<Button
									type="button"
									variant="outline"
									disabled={saving}
									onClick={() => run(() => window.search.removeEngine(engineId))}
								>
									{t('settings.integrations.remove', { name: t('settings.services.apiKey') })}
								</Button>
							)}
							<Button type="submit" disabled={saving || !apiKey.trim()}>
								{saving && <LoaderCircle className="size-3.5 animate-spin" />}
								{t('common.save')}
							</Button>
						</div>
					</form>
				</SettingsSection>
			</div>
		</SettingsPageShell>
	);
};

export default ServiceDetailsPage;
