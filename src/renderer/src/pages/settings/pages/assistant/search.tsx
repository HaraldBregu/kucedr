import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Search } from 'lucide-react';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { CatalogWebSearch } from '@shared/provider_types';
import type { SearchEngineId, SearchSettings } from '@shared/search_types';
import { SettingsNotice, SettingsRow } from '../../components';
import { firstErrorMessage } from '../../components/model-configuration-state';

const serviceId = (service: CatalogWebSearch): SearchEngineId =>
	`${service.provider.id}/${service.id}`;

export function SearchEngineService(): React.JSX.Element {
	const { t } = useTranslation();
	const [settings, setSettings] = useState<SearchSettings | null>(null);
	const [services, setServices] = useState<CatalogWebSearch[]>([]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const selected = services.find((service) => serviceId(service) === settings?.engineId);

	useEffect(() => {
		let mounted = true;
		void Promise.all([window.search.getSettings(), window.services.list()]).then(
			([next, list]) => {
				if (!mounted) return;
				setSettings(next);
				setServices(list.filter((service) => service.type === 'SEARCH_ENGINE'));
			},
			(loadError) => {
				if (mounted) setError(firstErrorMessage(loadError, t('settings.searchEngine.errors.load')));
			}
		);
		return () => {
			mounted = false;
		};
	}, [t]);

	const handleChange = (value: SearchEngineId | null): void => {
		if (!value) return;
		setSaving(true);
		setError(null);
		void window.search
			.selectEngine(value)
			.then(setSettings, (selectError) => {
				setError(firstErrorMessage(selectError, t('settings.searchEngine.errors.select')));
			})
			.finally(() => setSaving(false));
	};

	return (
		<>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			<SettingsRow
				title={t('settings.tabs.searchEngine')}
				icon={Search}
				description={t('settings.searchEngine.defaultDescription')}
				actions={
					<Select
						value={settings?.engineId ?? null}
						onValueChange={handleChange}
						disabled={!settings || saving}
					>
						<SelectTrigger
							className="w-40 max-w-full text-xs [&_svg]:size-3"
							aria-label={t('settings.tabs.searchEngine')}
						>
							<SelectValue placeholder={t('settings.searchEngine.defaultTitle')}>
								{selected ? `${selected.provider.name} - ${selected.name}` : undefined}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{services.map((service) => (
								<SelectItem
									key={serviceId(service)}
									value={serviceId(service)}
									disabled={!settings?.configured[serviceId(service)]}
								>
									{service.provider.name} - {service.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				}
			/>
		</>
	);
}
