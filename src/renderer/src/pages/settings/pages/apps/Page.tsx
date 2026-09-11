import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	Blocks,
	ExternalLink,
	FolderOpen,
	MoreHorizontal,
	RefreshCw,
	Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { App } from '../../../../../../shared/installed_app_types';
import Delete from './Delete';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';

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
	const [actionsOpen, setActionsOpen] = useState(false);
	const [appActionsOpen, setAppActionsOpen] = useState<string | null>(null);
	const [openingAppId, setOpeningAppId] = useState<string | null>(null);

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

	const handleOpenFolder = useCallback(async (): Promise<void> => {
		setErrorMessage('');
		try {
			await window.apps.openRoot();
		} catch (error) {
			setErrorMessage(getErrorMessage(error, t('settings.apps.openFolderError')));
		}
	}, [t]);

	const handleImport = useCallback(async (): Promise<void> => {
		setImporting(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const result = await window.apps.import();
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
	}, [loadApps, t]);

	const handleOpen = useCallback(
		async (appId: string): Promise<void> => {
			setOpeningAppId(appId);
			setErrorMessage('');
			try {
				await window.apps.open(appId);
			} catch (error) {
				setErrorMessage(getErrorMessage(error, t('settings.apps.openError')));
			} finally {
				setOpeningAppId(null);
			}
		},
		[t]
	);

	const handleDetails = useCallback(
		(appId: string): void => {
			navigate(`/settings/apps/${encodeURIComponent(appId)}`);
		},
		[navigate]
	);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.apps')}
				description={t('settings.apps.description')}
				action={
					<Popover open={actionsOpen} onOpenChange={setActionsOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								disabled={loading || importing}
								aria-label={t('common.moreOptions')}
							>
								<MoreHorizontal className="size-3.5" />
							</Button>
						</PopoverTrigger>
						<PopoverContent align="end" collisionPadding={12} className="w-52 p-1">
							<div role="menu" aria-label={t('common.moreOptions')}>
								<button
									type="button"
									role="menuitem"
									disabled={loading || importing}
									onClick={() => {
										setActionsOpen(false);
										void handleOpenFolder();
									}}
									className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50"
								>
									<FolderOpen className="size-3.5" />
									{t('settings.apps.openFolder')}
								</button>
								<button
									type="button"
									role="menuitem"
									disabled={loading || importing}
									onClick={() => {
										setActionsOpen(false);
										void loadApps();
									}}
									className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50"
								>
									<RefreshCw className="size-3.5" />
									{t('settings.apps.refresh')}
								</button>
								<button
									type="button"
									role="menuitem"
									disabled={loading || importing}
									onClick={() => {
										setActionsOpen(false);
										void handleImport();
									}}
									className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50"
								>
									<Upload className="size-3.5" />
									{importing ? t('settings.apps.uploading') : t('settings.apps.upload')}
								</button>
							</div>
						</PopoverContent>
					</Popover>
				}
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

			{successMessage && <SettingsNotice>{successMessage}</SettingsNotice>}

			<SettingsSection title={t('settings.apps.title')}>
				{loading ? (
					<SettingsPanel>
						<SettingsLoadingRows rows={2} />
					</SettingsPanel>
				) : apps.length === 0 ? (
					<SettingsPanel>
						<SettingsEmptyState
							icon={Blocks}
							title={t('settings.apps.empty')}
							description={t('settings.apps.emptyDescription')}
						/>
					</SettingsPanel>
				) : (
					<div className="grid gap-3">
						{apps.map((app) => (
							<Card
								key={app.id}
								size="sm"
								role="link"
								tabIndex={0}
								onClick={() => handleDetails(app.id)}
								onKeyDown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										handleDetails(app.id);
									}
								}}
								className="h-28 cursor-pointer gap-0! p-0! transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<CardContent className="grid h-full grid-cols-[7rem_minmax(0,1fr)] gap-3 p-3!">
									<div
										aria-hidden="true"
										className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/50 text-muted-foreground"
									>
										<Blocks className="size-4" strokeWidth={1.5} />
									</div>
									<div className="flex min-w-0 flex-col">
										<div className="flex min-w-0 items-start justify-between gap-3">
											<div className="min-w-0">
												<h3 className="truncate text-sm font-medium text-foreground">
													{app.title}
												</h3>
												<p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
													{app.description}
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-1">
												<Button
													type="button"
													size="xs"
													disabled={importing || openingAppId === app.id}
													onClick={(event) => {
														event.stopPropagation();
														void handleOpen(app.id);
													}}
													onKeyDown={(event) => event.stopPropagation()}
												>
													<ExternalLink className="size-3" />
													{t('settings.apps.open')}
												</Button>
												<Popover
													open={appActionsOpen === app.id}
													onOpenChange={(open) => setAppActionsOpen(open ? app.id : null)}
												>
													<PopoverTrigger asChild>
														<Button
															variant="outline"
															size="icon-xs"
															disabled={importing || openingAppId === app.id}
															aria-label={t('settings.apps.deleteAction', { name: app.title })}
															onClick={(event) => event.stopPropagation()}
															onKeyDown={(event) => event.stopPropagation()}
														>
															<MoreHorizontal className="size-3.5" />
														</Button>
													</PopoverTrigger>
													<PopoverContent align="end" collisionPadding={12} className="w-44 p-1">
														<div role="menu" aria-label={t('common.moreOptions')}>
															<Delete
																app={app}
																disabled={importing || openingAppId === app.id}
																menuItem
																onDeleted={(appId) => {
																	setAppActionsOpen(null);
																	setApps((current) => current.filter(({ id }) => id !== appId));
																}}
																onError={setErrorMessage}
															/>
														</div>
													</PopoverContent>
												</Popover>
											</div>
										</div>
										<div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
											<div className="flex flex-wrap items-center gap-1.5">
												<Badge variant="secondary" className="text-[10px] leading-none">
													{app.metadata.category}
												</Badge>
												<Badge variant="outline" className="text-[10px] leading-none">
													{app.metadata.version}
												</Badge>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default AppsPage;
