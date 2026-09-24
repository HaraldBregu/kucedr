import React, { useEffect, useState } from 'react';
import { ChevronRight, Database, HardDrive, Search, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SettingsPageHeader, SettingsPageShell, SettingsPanel, SettingsRow } from '../../components';
import type { EnabledPluginProviders } from '@shared/provider_types';

const PROVIDER_ITEMS = [
	{
		path: '/settings/providers/models',
		labelKey: 'settings.overview.groups.mlModels',
		descriptionKey: 'settings.overview.descriptions.providers',
		icon: Server,
	},
	{
		path: '/settings/providers/search',
		labelKey: 'settings.tabs.searchEngines',
		descriptionKey: 'settings.overview.descriptions.searchEngine',
		icon: Search,
	},
	{
		path: '/settings/providers/database',
		labelKey: 'settings.tabs.databases',
		descriptionKey: 'settings.overview.descriptions.databases',
		icon: Database,
	},
	{
		path: '/settings/providers/storage',
		labelKey: 'settings.tabs.storage',
		descriptionKey: 'settings.storageProviders.description',
		icon: HardDrive,
	},
] as const;

export default function ProvidersOverviewPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useState<EnabledPluginProviders>({ database: [], storage: [] });

	useEffect(() => {
		let active = true;
		void window.provider.listEnabledPlugins().then((value) => {
			if (active) setEnabled(value);
		});
		return () => { active = false; };
	}, []);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.providers')}
				description={t('settings.providers.description')}
			/>
			<SettingsPanel>
				{PROVIDER_ITEMS.map((item) => {
					if (item.path.endsWith('/database') && enabled.database.length === 0) return null;
					if (item.path.endsWith('/storage') && enabled.storage.length === 0) return null;
					const Icon = item.icon;
					return (
						<Link key={item.path} to={item.path} className="block hover:bg-muted/40">
							<SettingsRow
								title={t(item.labelKey)}
								description={t(item.descriptionKey)}
								media={<Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
								className="grid-cols-[minmax(0,1fr)_auto] border-b-0"
								actionClassName="w-auto justify-end"
								actions={<ChevronRight className="size-4 text-muted-foreground" />}
							/>
						</Link>
					);
				})}
			</SettingsPanel>
		</SettingsPageShell>
	);
}
