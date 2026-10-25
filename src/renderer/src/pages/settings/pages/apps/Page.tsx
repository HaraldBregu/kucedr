import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
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
	const [loading, setLoading] = useState(true);
	const [importing, setImporting] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
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
			setApps(await window.apps.list());
		} catch {
			setErrorMessage(t('settings.apps.loadError'));
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void loadApps();
	}, [loadApps]);

	const handleImport = useCallback(
		async (paths?: string[]): Promise<void> => {
			setImporting(true);
			setErrorMessage('');
			setSuccessMessage('');
			try {
				const result = await window.apps.import(paths);
				if (result) {
					if (result.imported.length > 0) {
						setSuccessMessage(
							t('settings.apps.uploaded', {
								count: String(result.imported.length),
								skipped: String(result.skipped.length),
							})
						);
						await loadApps();
					}
					if (result.skipped.length > 0) {
						setErrorMessage((current) =>
							[current, ...result.skipped.map(({ name, reason }) => `${name}: ${reason}`)]
								.filter(Boolean)
								.join('\n')
						);
					}
				}
			} catch (error) {
				setErrorMessage(getErrorMessage(error, t('settings.apps.uploadError')));
			} finally {
				setImporting(false);
			}
		},
		[loadApps, t]
	);

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

			{successMessage && <SettingsNotice autoDismiss>{successMessage}</SettingsNotice>}

			{!loading && apps.length === 0 && (
				<SettingsUpload
					title={t('settings.apps.dropTitle')}
					description={t('settings.apps.emptyDescription')}
					busy={importing}
					busyLabel={t('settings.apps.uploading')}
					onUpload={(paths) => void handleImport(paths)}
				/>
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
							<SettingsUpload
								title={t('settings.apps.addTitle')}
								description={t('settings.apps.dropTitle')}
								busy={importing}
								busyLabel={t('settings.apps.uploading')}
								onUpload={(paths) => void handleImport(paths)}
								className="h-22 flex-row items-center gap-3 px-4 py-0 text-left"
							/>
							{visibleApps.map((app) => (
								<Card
									key={app.id}
									size="sm"
									role="link"
									tabIndex={0}
									className="h-22 cursor-pointer transition-colors hover:bg-muted hover:ring-foreground/20 focus-visible:bg-muted focus-visible:ring-foreground/20"
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
									<CardHeader className="flex items-start gap-3">
										<AppIcon app={app} className="size-8" />
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
												<span className="truncate">{app.title}</span>
												<span className="text-xs font-normal text-muted-foreground">
													{app.metadata.version}
												</span>
												{import.meta.env.DEV && app.debugPath && (
													<Badge variant="outline">{t('settings.apps.debug.badge')}</Badge>
												)}
											</CardTitle>
											<CardDescription className="line-clamp-2">{app.description}</CardDescription>
										</div>
										<div
											className="flex shrink-0 items-center gap-1"
											onClick={(event) => event.stopPropagation()}
											onKeyDown={(event) => event.stopPropagation()}
										>
											<Button
												type="button"
												size="sm"
												variant="outline"
												disabled={importing || openingAppId === app.id}
												onClick={() => void handleOpen(app)}
											>
												{t('settings.apps.open')}
											</Button>
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
