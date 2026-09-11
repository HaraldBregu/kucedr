import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	Blocks,
	ChevronRight,
	FolderOpen,
	MoreHorizontal,
	RefreshCw,
	Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
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

	const appPath = useCallback(
		(appId: string): string => `/settings/apps/${encodeURIComponent(appId)}`,
		[]
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
				<SettingsNotice variant="destructive" icon={AlertTriangle} className="whitespace-pre-wrap break-words">
					{errorMessage}
				</SettingsNotice>
			)}

			{successMessage && <SettingsNotice>{successMessage}</SettingsNotice>}

			<SettingsSection title={t('settings.apps.title')}>
				<SettingsPanel>
					{loading ? (
						<SettingsLoadingRows rows={2} />
					) : apps.length === 0 ? (
						<SettingsEmptyState
							icon={Blocks}
							title={t('settings.apps.empty')}
							description={t('settings.apps.emptyDescription')}
						/>
					) : (
						apps.map((app) => (
							<div
								key={app.id}
								className="flex items-center border-b border-border/60 hover:bg-muted/40 last:border-b-0"
							>
								<Item
									as="button"
									type="button"
									variant="outline"
									size="md"
									className="min-w-0 flex-1 cursor-pointer pl-5 pr-3 py-4 text-left"
									onClick={() => navigate(appPath(app.id))}
								>
									<ItemContent className="min-w-0 flex-1 flex-col items-start gap-1">
										<ItemTitle className="max-w-full truncate">{app.title}</ItemTitle>
										<p className="line-clamp-2 max-w-full text-[11px] leading-4 text-muted-foreground">
											{app.description}
										</p>
									</ItemContent>
									<ItemActions className="ml-auto flex-none items-center justify-end gap-2">
										<Badge variant="secondary" className="text-[10px] leading-none">
											{app.metadata.category}
										</Badge>
										<ChevronRight className="size-3.5 text-muted-foreground" strokeWidth={1.8} />
									</ItemActions>
								</Item>
								<Delete
									app={app}
									disabled={loading || importing}
									onDeleted={(appId) => {
										setApps((current) =>
											current.filter(({ id }) => id !== appId)
										);
									}}
									onError={setErrorMessage}
								/>
							</div>
						))
					)}
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default AppsPage;
