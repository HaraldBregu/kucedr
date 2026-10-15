import React from 'react';
import { ChevronRight, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
} from '../../components';

const PROVIDER_ITEMS: readonly {
	path: string;
	labelKey: string;
	descriptionKey: string;
	icon: LucideIcon;
}[] = [];

export default function ProvidersOverviewPage(): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.providers')}
				description={t('settings.providers.description')}
			/>
			<SettingsPanel>
				{PROVIDER_ITEMS.map((item) => {
					const Icon = item.icon;
					return (
						<Link key={item.path} to={item.path} className="block hover:bg-muted/40">
							<SettingsRow
								title={t(item.labelKey)}
								description={t(item.descriptionKey)}
								media={
									<Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
								}
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
