import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AlertTriangle,
	Blocks,
	Bug,
	ExternalLink,
	FolderOpen,
	MoreHorizontal,
	RefreshCw,
	Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { App } from '../../../../../../shared/installed_app_types';
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
	const [apps, setApps] = useState<App[]>([]);
	const [loading, setLoading] = useState(true);
	const [importing, setImporting] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [actionsOpen, setActionsOpen] = useState(false);
	const [openingAppId, setOpeningAppId] = useState<string | null>(null);
	const [debugPath, setDebugPath] = useState('');
	const [addingDebug, setAddingDebug] = useState(false);
	const [selectingDebug, setSelectingDebug] = useState(false);

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

	const handleAddDebug = useCallback(async (): Promise<void> => {
		setAddingDebug(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			await window.apps.addDebug(debugPath);
			setDebugPath('');
			setSuccessMessage(t('settings.apps.debug.added'));
			await loadApps();
		} catch (error) {
			setErrorMessage(getErrorMessage(error, t('settings.apps.debug.addError')));
		} finally {
			setAddingDebug(false);
		}
	}, [debugPath, loadApps, t]);

	const handleSelectDebug = useCallback(async (): Promise<void> => {
		setSelectingDebug(true);
		setErrorMessage('');
		try {
			const selectedPath = await window.apps.selectDebugPath();
			if (selectedPath) setDebugPath(selectedPath);
		} catch (error) {
			setErrorMessage(getErrorMessage(error, t('settings.apps.debug.selectError')));
		} finally {
			setSelectingDebug(false);
		}
	}, [t]);

	return (
		<SettingsPageShell className="max-w-none">
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

			{successMessage && <SettingsNotice autoDismiss>{successMessage}</SettingsNotice>}

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
					<div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
						{apps.map((app) => (
							<Card key={app.id} size="sm" className="min-h-28 gap-2">
								<CardContent className="flex h-full min-w-0 flex-col gap-2">
									<div className="flex min-w-0 items-start gap-3">
										{app.imageUrl ? (
											<img
												src={app.imageUrl}
												alt=""
												className="size-12 shrink-0 rounded-lg border border-border/70 object-cover"
											/>
										) : (
											<div
												aria-hidden="true"
												className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border/70 text-muted-foreground"
											>
												<Blocks className="size-4" strokeWidth={1.5} />
											</div>
										)}
										<div className="min-w-0 flex-1">
											<div className="flex min-w-0 items-center gap-1.5">
												<h3 className="truncate text-sm font-medium text-foreground">
													{app.title}
												</h3>
												{app.debugPath && (
													<Badge variant="outline" className="shrink-0 text-[10px] leading-none">
														{t('settings.apps.debug.badge')}
													</Badge>
												)}
											</div>
											<div className="mt-1 flex flex-wrap items-center gap-1.5">
												<Badge variant="secondary" className="text-[10px] leading-none">
													{app.metadata.category}
												</Badge>
												<Badge variant="outline" className="text-[10px] leading-none">
													{app.metadata.version}
												</Badge>
											</div>
										</div>
										<div className="shrink-0">
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
										</div>
									</div>
									<p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
										{app.description}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</SettingsSection>

			<SettingsSection
				title={t('settings.apps.debug.title')}
				description={t('settings.apps.debug.description')}
			>
				<SettingsPanel>
					<form
						className="flex items-center gap-2 p-4"
						onSubmit={(event) => {
							event.preventDefault();
							void handleAddDebug();
						}}
					>
						<Bug className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<Input
							type="text"
							value={debugPath}
							placeholder={t('settings.apps.debug.placeholder')}
							aria-label={t('settings.apps.debug.pathLabel')}
							readOnly
							disabled={addingDebug || selectingDebug}
							className="h-8 min-w-0 font-mono text-xs"
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={addingDebug || selectingDebug}
							onClick={() => void handleSelectDebug()}
						>
							<FolderOpen className="size-3.5" />
							{selectingDebug
								? t('settings.apps.debug.selecting')
								: t('settings.apps.debug.select')}
						</Button>
						<Button type="submit" size="sm" disabled={addingDebug || !debugPath.trim()}>
							{addingDebug ? t('settings.apps.debug.adding') : t('settings.apps.debug.add')}
						</Button>
					</form>
					{apps.some((app) => app.debugPath) && (
						<div className="border-t border-border/70 px-4 py-3">
							<p className="mb-2 text-xs font-medium text-foreground">
								{t('settings.apps.debug.registered')}
							</p>
							<div className="grid gap-1.5">
								{apps
									.filter((app) => app.debugPath)
									.map((app) => (
										<p key={app.id} className="truncate font-mono text-xs text-muted-foreground">
											{app.debugPath}
										</p>
									))}
							</div>
						</div>
					)}
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default AppsPage;
