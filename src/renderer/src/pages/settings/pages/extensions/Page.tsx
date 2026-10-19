import React, { useEffect, useState } from 'react';
import { LayoutPanelLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PluginExtension, PluginInfo } from '@shared/plugin_types';
import { Badge } from '@/components/ui/badge';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';

type Entry = PluginExtension & { readonly plugin: PluginInfo };

export default function ExtensionsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [entries, setEntries] = useState<Entry[] | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		window.plugins
			.list()
			.then((plugins) =>
				setEntries(
					plugins
						.filter((plugin) => plugin.enabled && !plugin.error)
						.flatMap((plugin) => plugin.extensions.map((extension) => ({ ...extension, plugin })))
				)
			)
			.catch(() => setError(true));
	}, []);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.extensions.title')}
				description={t('settings.extensions.description')}
			/>
			{error && <SettingsNotice variant="destructive">{t('settings.extensions.loadError')}</SettingsNotice>}
			{entries === null ? (
				!error && (
					<SettingsPanel>
						<SettingsLoadingRows rows={2} />
					</SettingsPanel>
				)
			) : entries.length === 0 ? (
				<SettingsEmptyState
					icon={LayoutPanelLeft}
					title={t('settings.extensions.empty')}
					description={t('settings.extensions.emptyDescription')}
				/>
			) : (
				<div className="-mx-4 grid grid-cols-1 gap-x-2 gap-y-3 md:grid-cols-2">
					{entries.map((entry) => (
						<Item
							key={`${entry.plugin.id}/${entry.id}`}
							variant="ghost"
							size="md"
							className="min-w-0 flex-nowrap gap-3 rounded-2xl px-3 py-2"
						>
							<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
								<ItemTitle className="min-w-0 max-w-full truncate text-sm font-medium leading-tight">
									{entry.title}
								</ItemTitle>
								<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
									{entry.plugin.name}
								</p>
							</ItemContent>
							<ItemActions className="ml-auto flex-none">
								<Badge variant="secondary">{t(`settings.extensions.slots.${entry.slot}`)}</Badge>
							</ItemActions>
						</Item>
					))}
				</div>
			)}
		</SettingsPageShell>
	);
}
