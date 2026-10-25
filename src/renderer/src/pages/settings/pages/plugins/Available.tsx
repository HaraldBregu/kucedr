import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AvailablePlugin } from '@shared/plugin_types';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingsNotice } from '../../components';
import PluginIcon from './PluginIcon';

export default function Available({
	onInstalled,
}: {
	readonly onInstalled: (name: string) => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	const [plugins, setPlugins] = useState<AvailablePlugin[] | null>(null);
	const [installing, setInstalling] = useState<string | null>(null);
	const [error, setError] = useState('');

	useEffect(() => {
		window.plugins
			.available()
			.then(setPlugins)
			.catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
	}, []);

	const install = async (plugin: AvailablePlugin): Promise<void> => {
		setInstalling(plugin.id);
		setError('');
		try {
			const installed = await window.plugins.installCatalog(plugin.id);
			onInstalled(installed.name);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
			setInstalling(null);
		}
	};

	return (
		<section className="pb-4" aria-labelledby="available-plugins-title">
			<h2 id="available-plugins-title" className="mb-2 text-sm font-medium">
				{t('settings.integrations.available.title')}
			</h2>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			{plugins === null && !error && (
				<p className="text-sm text-muted-foreground">
					{t('settings.integrations.available.loading')}
				</p>
			)}
			{plugins?.length === 0 && (
				<p className="text-sm text-muted-foreground">
					{t('settings.integrations.available.empty')}
				</p>
			)}
			<div className="grid grid-cols-1 gap-3">
				{plugins?.map((plugin) => (
					<Card key={plugin.id} size="sm" className="h-22">
						<CardHeader className="flex flex-1 items-center gap-3">
							<PluginIcon plugin={plugin} className="size-12" />
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
									<span className="truncate">{plugin.title}</span>
								</CardTitle>
								<CardDescription className="line-clamp-2">{plugin.description}</CardDescription>
							</div>
							<span className="shrink-0 text-xs text-muted-foreground">{plugin.version}</span>
							<Button
								type="button"
								size="sm"
								disabled={installing !== null}
								onClick={() => void install(plugin)}
							>
								{installing === plugin.id
									? t('settings.integrations.installed.installing')
									: plugin.update
										? t('settings.integrations.available.update')
										: t('settings.integrations.installed.install')}
							</Button>
						</CardHeader>
					</Card>
				))}
			</div>
		</section>
	);
}
