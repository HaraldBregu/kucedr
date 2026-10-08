import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	Blocks,
	Bug,
	ExternalLink,
	FolderOpen,
	MoreHorizontal,
	RefreshCw,
	Search,
	Upload,
	X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
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
	const navigate = useNavigate();
	const [apps, setApps] = useState<App[]>([]);
	const [query, setQuery] = useState('');
	const [loading, setLoading] = useState(true);
	const [importing, setImporting] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [actionsOpen, setActionsOpen] = useState(false);
	const [openingAppId, setOpeningAppId] = useState<string | null>(null);
	const [debugPath, setDebugPath] = useState('');
	const [addingDebug, setAddingDebug] = useState(false);
	const [selectingDebug, setSelectingDebug] = useState(false);
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const filteredApps = apps.filter(
		(app) =>
			!normalizedQuery ||
			[app.title, app.description, app.handle ?? '', app.id].some((value) =>
				value.toLocaleLowerCase().includes(normalizedQuery)
			)
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
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.apps')}
				description={t('settings.apps.description')}
				action={
					<div className="flex w-full items-center gap-2 sm:w-auto">
						<div className="relative min-w-0 flex-1 sm:w-64">
							<Search
								className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
								aria-hidden="true"
							/>
							<Input
								type="text"
								role="searchbox"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={t('settings.apps.searchPlaceholder')}
								aria-label={t('settings.apps.search')}
								className="rounded-xl px-9"
							/>
							{query && (
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="absolute right-1 top-1/2 -translate-y-1/2 hover:bg-transparent dark:hover:bg-transparent"
									onClick={() => setQuery('')}
									aria-label={t('settings.apps.clearSearch')}
								>
									<X className="size-4" aria-hidden="true" />
								</Button>
							)}
						</div>
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
					</div>
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

			<section className="-mx-4 pb-4" aria-labelledby="installed-apps-title">
				<h2 id="installed-apps-title" className="mb-2 px-3 text-sm font-medium">
					{t('settings.apps.title')}
				</h2>
				{loading ? (
					<SettingsPanel>
						<SettingsLoadingRows rows={2} />
					</SettingsPanel>
				) : apps.length === 0 ? (
					<SettingsEmptyState
						icon={Blocks}
						title={t('settings.apps.empty')}
						description={t('settings.apps.emptyDescription')}
					/>
				) : filteredApps.length === 0 ? (
					<SettingsEmptyState
						icon={Search}
						title={t('settings.apps.noResults')}
						description={t('settings.apps.noResultsDescription')}
					/>
				) : (
					<div className="grid grid-cols-1 gap-x-2 gap-y-3 md:grid-cols-2">
						{filteredApps.map((app) => (
							<Item
								key={app.id}
								role="link"
								tabIndex={0}
								variant="ghost"
								size="md"
								className="min-w-0 cursor-pointer flex-nowrap gap-3 rounded-2xl px-3 py-2 hover:bg-muted/50 focus-within:bg-muted/50"
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
								{app.imageUrl ? (
									<img
										src={app.imageUrl}
										alt=""
										className="size-10 shrink-0 rounded-2xl bg-muted/50 object-contain p-2.5"
									/>
								) : (
									<div
										aria-hidden="true"
										className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground"
									>
										<Blocks className="size-5" />
									</div>
								)}
								<ItemContent className="min-w-0 flex-1 flex-col items-start gap-1">
									<ItemTitle className="min-w-0 max-w-full gap-1.5 text-sm font-medium leading-tight">
										<h3 className="truncate">{app.title}</h3>
										{import.meta.env.DEV && app.debugPath && (
											<Badge variant="outline" className="shrink-0 text-[10px] leading-none">
												{t('settings.apps.debug.badge')}
											</Badge>
										)}
									</ItemTitle>
									<p className="max-w-full truncate text-[11px] leading-tight text-muted-foreground">
										{app.handle ?? `@${app.id}`}
									</p>
									<p className="line-clamp-2 text-xs leading-4 text-muted-foreground">
										{app.description}
									</p>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<Button
										type="button"
										variant="outline"
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
								</ItemActions>
							</Item>
						))}
					</div>
				)}
			</section>

			{import.meta.env.DEV && (
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
							<div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
								<Bug className="size-5" aria-hidden="true" />
							</div>
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
			)}
		</SettingsPageShell>
	);
};

export default AppsPage;
