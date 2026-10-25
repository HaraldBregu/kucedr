import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Tag, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useOpenApp } from '@/hooks/app';
import type { App } from '../../../../../../shared/installed_app_types';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';
import { SettingsFilter } from '../../components/filter';
import { SettingsUpload } from '../../components/upload';
import AppIcon from './AppIcon';

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}
	return fallback;
}

const AppsPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [apps, setApps] = useState<App[]>([]);
	const [pluginAuthors, setPluginAuthors] = useState<Map<string, string>>(new Map());
	const [loading, setLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState('');
	const [openingAppId, setOpeningAppId] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState('all');
	const categories = useMemo(
		() => [...new Set(apps.map((app) => app.metadata.category))].sort(),
		[apps]
	);
	const visibleApps = apps.filter(
		(app) =>
			(category === 'all' || app.metadata.category === category) &&
			`${app.title} ${app.description}`.toLowerCase().includes(query.trim().toLowerCase())
	);

	const loadApps = useCallback(async (): Promise<void> => {
		setLoading(true);
		setErrorMessage('');
		try {
			const [list, plugins] = await Promise.all([window.apps.list(), window.plugins.list()]);
			setApps(list);
			setPluginAuthors(
				new Map(plugins.flatMap((plugin) => (plugin.author ? [[plugin.id, plugin.author]] : [])))
			);
		} catch {
			setErrorMessage(t('settings.apps.loadError'));
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void loadApps();
	}, [loadApps]);

	const openApp = useOpenApp();
	const handleOpen = useCallback(
		async (app: App): Promise<void> => {
			setOpeningAppId(app.id);
			setErrorMessage('');
			try {
				await openApp(app);
			} catch (error) {
				setErrorMessage(getErrorMessage(error, t('settings.apps.openError')));
			} finally {
				setOpeningAppId(null);
			}
		},
		[openApp, t]
	);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.apps')}
				description={t('settings.apps.description')}
			/>

			{errorMessage && (
				<SettingsNotice
					variant="destructive"
					icon={AlertTriangle}
					className="whitespace-pre-wrap break-words"
				>
					{errorMessage}
				</SettingsNotice>
			)}

			{!loading && apps.length === 0 && (
				<SettingsEmptyState icon={LayoutGrid} title={t('settings.apps.empty')} />
			)}

			{(loading || apps.length > 0) && (
				<section className="pb-4" aria-labelledby="installed-apps-title">
					<h2 id="installed-apps-title" className="mb-2 text-sm font-medium">
						{t('settings.apps.title')}
					</h2>
					<SettingsFilter
						query={query}
						onQueryChange={setQuery}
						categories={categories}
						category={category}
						onCategoryChange={setCategory}
					/>
					{loading ? (
						<SettingsPanel>
							<SettingsLoadingRows rows={2} />
						</SettingsPanel>
					) : (
						<div className="grid grid-cols-1 gap-3">
							{visibleApps.map((app) => (
								<Card
									key={app.id}
									size="sm"
									role="link"
									tabIndex={0}
									className="cursor-pointer transition-colors hover:bg-muted hover:ring-foreground/20 focus-visible:bg-muted focus-visible:ring-foreground/20"
									onClick={() => navigate(`/settings/apps/${encodeURIComponent(app.id)}`)}
									onKeyDown={(event) => {
										if (
											event.target === event.currentTarget &&
											(event.key === 'Enter' || event.key === ' ')
										) {
											event.preventDefault();
											navigate(`/settings/apps/${encodeURIComponent(app.id)}`);
										}
									}}
								>
									<CardHeader className="flex flex-1 items-center gap-3">
										<AppIcon app={app} className="size-12" />
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<div className="flex items-center gap-2">
												<CardTitle className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
													<span className="truncate">{app.title}</span>
													{import.meta.env.DEV && app.debugPath && (
														<Badge variant="outline">{t('settings.apps.debug.badge')}</Badge>
													)}
												</CardTitle>
												<Button
													type="button"
													size="sm"
													variant="outline"
													disabled={importing || openingAppId === app.id}
													onClick={(event) => {
														event.stopPropagation();
														void handleOpen(app);
													}}
													onKeyDown={(event) => event.stopPropagation()}
												>
													{t('settings.apps.open')}
												</Button>
											</div>
											<CardDescription className="line-clamp-1">{app.description}</CardDescription>
											<div className="flex items-center gap-3 text-xs text-muted-foreground">
												<span className="flex items-center gap-1">
													<Tag className="size-3" aria-hidden="true" />
													<span className="sr-only">
														{t('settings.integrations.plugin.version')}
													</span>
													{app.metadata.version}
												</span>
												{(app.author ?? pluginAuthors.get(app.plugin?.id ?? '')) && (
													<span className="flex items-center gap-1">
														<User className="size-3" aria-hidden="true" />
														<span className="sr-only">
															{t('settings.integrations.plugin.author')}
														</span>
														{app.author ?? pluginAuthors.get(app.plugin?.id ?? '')}
													</span>
												)}
											</div>
										</div>
									</CardHeader>
								</Card>
							))}
						</div>
					)}
				</section>
			)}
		</SettingsPageShell>
	);
};

export default AppsPage;
