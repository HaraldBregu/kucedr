import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Blocks, ExternalLink, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import type { App } from '../../../../../../shared/installed_app_types';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
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
	const [dragging, setDragging] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
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

			<button
				type="button"
				disabled={importing}
				onClick={() => void handleImport()}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setDragging(false);
					const paths = Array.from(event.dataTransfer.files).map((file) =>
						window.app.getPathForFile(file)
					);
					if (paths.length > 0) void handleImport(paths);
				}}
				className={cn(
					'flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
					dragging && 'border-primary bg-muted/50'
				)}
			>
				<div className="flex size-10 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
					<Upload className="size-5" aria-hidden="true" />
				</div>
				<span className="text-sm font-medium">
					{importing ? t('settings.apps.uploading') : t('settings.apps.dropTitle')}
				</span>
				<span className="text-xs text-muted-foreground">{t('settings.apps.emptyDescription')}</span>
			</button>

			<section className="-mx-4 pb-4" aria-labelledby="installed-apps-title">
				<h2 id="installed-apps-title" className="mb-2 px-3 text-sm font-medium">
					{t('settings.apps.title')}
				</h2>
				{loading ? (
					<SettingsPanel>
						<SettingsLoadingRows rows={2} />
					</SettingsPanel>
				) : apps.length === 0 ? (
					<p className="px-3 text-xs text-muted-foreground">{t('settings.apps.empty')}</p>
				) : (
					<div className="grid grid-cols-1 gap-x-2 gap-y-3 md:grid-cols-2">
						{apps.map((app) => (
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
		</SettingsPageShell>
	);
};

export default AppsPage;
