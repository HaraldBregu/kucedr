import React, { useEffect, useState } from 'react';
import { Tag, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
	const navigate = useNavigate();
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
		<section className="pb-4">
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
					<Card
						key={plugin.id}
						size="sm"
						role="link"
						tabIndex={0}
						className="cursor-pointer transition-colors hover:bg-muted hover:ring-foreground/20 focus-visible:bg-muted focus-visible:ring-foreground/20"
						onClick={() => navigate(`/settings/plugins/marketplace/${plugin.id}`)}
						onKeyDown={(event) => {
							if (
								event.target === event.currentTarget &&
								(event.key === 'Enter' || event.key === ' ')
							) {
								event.preventDefault();
								navigate(`/settings/plugins/marketplace/${plugin.id}`);
							}
						}}
					>
						<CardHeader className="flex flex-1 items-center gap-3">
							<PluginIcon plugin={plugin} className="size-12" />
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<div className="flex items-center gap-2">
									<CardTitle className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
										<span className="truncate">{plugin.title}</span>
									</CardTitle>
									<Button
										type="button"
										size="sm"
										disabled={installing !== null}
										onClick={(event) => {
											event.stopPropagation();
											void install(plugin);
										}}
										onKeyDown={(event) => event.stopPropagation()}
									>
										{installing === plugin.id
											? t('settings.integrations.installed.installing')
											: plugin.update
												? t('settings.integrations.available.update')
												: t('settings.integrations.installed.install')}
									</Button>
								</div>
								<CardDescription className="line-clamp-1">{plugin.description}</CardDescription>
								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									<span className="flex items-center gap-1">
										<User className="size-3" aria-hidden="true" />
										<span className="sr-only">{t('settings.integrations.plugin.author')}</span>
										{plugin.author}
									</span>
									<span className="flex items-center gap-1">
										<Tag className="size-3" aria-hidden="true" />
										<span className="sr-only">{t('settings.integrations.plugin.version')}</span>
										{plugin.version}
									</span>
								</div>
							</div>
						</CardHeader>
					</Card>
				))}
			</div>
		</section>
	);
}
