import React, { useCallback, useEffect, useState } from 'react';
import {
	AlertTriangle,
	Download,
	FolderSync,
	Plus,
	Save,
	Trash2,
	Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardFooter,
} from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type {
	StorageOperationStatus,
	StorageProvider,
	StorageSyncFolder,
	StorageSyncSettings,
} from '@shared/storage_types';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsRow,
	SettingsSection,
} from '../../components';
import { SYNC_INTERVALS } from './constants';
import Provider from './Provider';

interface StoragePageProps {
	readonly inline?: boolean;
}

const StoragePage: React.FC<StoragePageProps> = ({ inline = false }) => {
	const { t } = useTranslation();
	const [settings, setSettings] = useState<StorageSyncSettings | null>(null);
	const [providers, setProviders] = useState<StorageProvider[]>([]);
	const [settingsLoading, setSettingsLoading] = useState(true);
	const [availableFolders, setAvailableFolders] = useState<StorageSyncFolder[]>([]);
	const [draft, setDraft] = useState<StorageSyncSettings | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [syncStatus, setSyncStatus] = useState<string | null>(null);
	const [savingSync, setSavingSync] = useState(false);
	const [operationStatus, setOperationStatus] = useState<StorageOperationStatus>();
	const [operationStatusLoading, setOperationStatusLoading] = useState(true);
	const [restoreOpen, setRestoreOpen] = useState(false);
	const [loadFailed, setLoadFailed] = useState(false);
	const [loadVersion, setLoadVersion] = useState(0);
	const applyOperationStatus = useCallback((status: StorageOperationStatus): void => {
		setOperationStatus((current) =>
			current && current.revision >= status.revision ? current : status
		);
	}, []);

	useEffect(() => {
		let cancelled = false;
		const unsubscribe = window.storage.onOperationStatusChanged((status) => {
			if (!cancelled) applyOperationStatus(status);
		});
		void Promise.allSettled([
			window.storage.getSettings(),
			window.storage.syncFolders(),
			window.storage.getOperationStatus(),
			window.storage.listProviders(),
		]).then(([settingsResult, foldersResult, statusResult, providersResult]) => {
			if (cancelled) return;

			if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value);
			if (foldersResult.status === 'fulfilled') setAvailableFolders(foldersResult.value);
			if (providersResult.status === 'fulfilled') setProviders(providersResult.value);
			if (statusResult.status === 'fulfilled' && statusResult.value) {
				applyOperationStatus(statusResult.value);
			}

			const failed = [settingsResult, foldersResult, statusResult, providersResult].some(
				(result) => result.status === 'rejected'
			);
			setLoadFailed(failed);
			if (failed) setError(t('settings.storage.errors.load'));
			setSettingsLoading(false);
			setOperationStatusLoading(false);
		});
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [applyOperationStatus, loadVersion, t]);

	const storage = draft ?? settings;
	const selectedProvider = providers.find((provider) => provider.id === storage?.providerId);
	const visibleFolders = availableFolders.filter((folder) => folder.key !== 'library');
	const runningOperation = operationStatus?.state === 'running' ? operationStatus : undefined;
	const builtInPaths = new Set(availableFolders.map((folder) => folder.path));
	const customPaths = storage?.paths.filter((entry) => !builtInPaths.has(entry)) ?? [];
	const intervalValue = !storage?.syncEnabled
		? 'off'
		: (SYNC_INTERVALS.find((interval) => interval.cron === storage.syncCronExpression)?.key ??
			'custom');
	const busy = settingsLoading || operationStatusLoading || savingSync || Boolean(runningOperation);
	const controlsDisabled = busy || !selectedProvider;
	const operationStatusKey = operationStatus
		? operationStatus.state === 'running' && operationStatus.trigger === 'scheduled'
			? `settings.storage.operation.${operationStatus.operation}.scheduledRunning`
			: `settings.storage.operation.${operationStatus.operation}.${operationStatus.state}`
		: undefined;
	const operationStatusText = operationStatusKey
		? t(operationStatusKey, {
				count: operationStatus?.transferred,
				failed: operationStatus?.failed,
				error:
					operationStatus?.operation === 'backup'
						? t('settings.storage.errors.push')
						: t('settings.storage.errors.pull'),
			})
		: undefined;
	const operationNeedsAttention =
		operationStatus?.state === 'failed' || operationStatus?.state === 'partial';

	const updateDraft = (next: StorageSyncSettings): void => {
		setDraft(next);
		setSyncStatus(null);
	};

	const selectProvider = (providerId: string): void => {
		if (!storage) return;
		updateDraft({ ...storage, providerId });
	};

	const pickFolders = async (): Promise<void> => {
		if (!storage) return;
		setError(null);
		try {
			const paths = await window.storage.pickFolders();
			if (paths.length > 0) {
				updateDraft({ ...storage, paths: [...new Set([...storage.paths, ...paths])] });
			}
		} catch {
			setError(t('settings.storage.errors.pickFolders'));
		}
	};

	const saveSync = async (): Promise<StorageSyncSettings | undefined> => {
		if (!storage) return undefined;
		setSavingSync(true);
		setError(null);
		setSyncStatus(null);
		try {
			const saved = await window.storage.saveSettings(storage);
			setSettings(saved);
			setDraft(null);
			setSyncStatus(t('settings.storage.syncSaved'));
			return saved;
		} catch {
			setError(t('settings.storage.errors.saveSync'));
			return undefined;
		} finally {
			setSavingSync(false);
		}
	};

	const runBackup = async (): Promise<void> => {
		setError(null);
		setSyncStatus(null);
		try {
			if (!(await saveSync())) return;
			applyOperationStatus(await window.storage.backup());
		} catch {
			setError(t('settings.storage.errors.push'));
		}
	};

	const runRestore = async (): Promise<void> => {
		setRestoreOpen(false);
		setError(null);
		setSyncStatus(null);
		try {
			if (!(await saveSync())) return;
			applyOperationStatus(await window.storage.restore());
		} catch {
			setError(t('settings.storage.errors.pull'));
		}
	};

	const retryLoad = (): void => {
		setError(null);
		setLoadFailed(false);
		setSettingsLoading(true);
		setOperationStatusLoading(true);
		setLoadVersion((current) => current + 1);
	};

	const selectInterval = (value: string | null): void => {
		if (!storage || !value) return;
		if (value === 'off') {
			updateDraft({ ...storage, syncEnabled: false });
			return;
		}
		const cron = SYNC_INTERVALS.find((interval) => interval.key === value)?.cron;
		updateDraft({
			...storage,
			syncEnabled: true,
			syncCronExpression: cron ?? storage.syncCronExpression,
		});
	};

	return (
		<SettingsPageShell className={inline ? 'max-w-none p-0 sm:p-0' : undefined}>
			{!inline && (
				<SettingsPageHeader
					title={t('settings.storage.configurationTitle')}
					description={t('settings.storage.description')}
				/>
			)}

			{error && (
				<div className="flex flex-wrap items-center gap-2">
					<SettingsNotice className="min-w-0 flex-1" variant="destructive" icon={AlertTriangle}>
						{error}
					</SettingsNotice>
					{loadFailed && (
						<Button type="button" variant="outline" size="sm" onClick={retryLoad}>
							{t('common.tryAgain')}
						</Button>
					)}
				</div>
			)}

			{settingsLoading && !storage ? (
				<div aria-busy="true">
					<SettingsLoadingRows rows={4} />
				</div>
			) : storage ? (
				<>
					<Provider
						providers={providers}
						providerId={storage.providerId}
						disabled={busy}
						onChange={selectProvider}
					/>
					<SettingsSection
						title={t('settings.storage.sync.title')}
						description={t('settings.storage.sync.description')}
						action={
							<Button
								variant="outline"
								size="icon-sm"
								aria-label={t('settings.storage.sync.addFolders')}
								disabled={controlsDisabled}
								onClick={() => void pickFolders()}
							>
								<Plus className="size-3" />
							</Button>
						}
					>
					<Card size="sm" className="gap-0! py-0!" aria-busy={Boolean(runningOperation)}>
						<CardContent className="p-0!">
							{visibleFolders.map((folder) => (
								<SettingsRow
									key={folder.path}
									title={t(`settings.storage.folders.${folder.key}`)}
									description={folder.path}
									className="grid-cols-[minmax(0,1fr)_auto]"
									actionClassName="ml-auto w-auto justify-end"
									actions={
										<Switch
											checked={storage.paths.includes(folder.path)}
											aria-label={t(`settings.storage.folders.${folder.key}`)}
											disabled={controlsDisabled}
											onCheckedChange={(checked) =>
												updateDraft({
													...storage,
													paths: checked
														? [...new Set([...storage.paths, folder.path])]
														: storage.paths.filter((entry) => entry !== folder.path),
												})
											}
										/>
									}
								/>
							))}

							{customPaths.map((selectedPath) => (
								<SettingsRow
									key={selectedPath}
									title={t('settings.storage.sync.folder')}
									description={selectedPath}
									className="grid-cols-[minmax(0,1fr)_auto] [&_p]:break-all"
									actionClassName="ml-auto w-auto justify-end"
									actions={
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={t('settings.storage.sync.removeFolder')}
											disabled={controlsDisabled}
											onClick={() =>
												updateDraft({
													...storage,
													paths: storage.paths.filter((entry) => entry !== selectedPath),
												})
											}
										>
											<Trash2 className="size-3" />
										</Button>
									}
								/>
							))}

							<SettingsRow
								title={t('settings.storage.autoSync.interval')}
								description={t('settings.storage.autoSync.description')}
								actions={
									<Select
										value={intervalValue}
										onValueChange={selectInterval}
										disabled={controlsDisabled}
									>
										<SelectTrigger
											size="sm"
											className="w-56 max-w-full text-xs"
											aria-label={t('settings.storage.autoSync.interval')}
										>
											<SelectValue>{t(`settings.storage.autoSync.${intervalValue}`)}</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="off">{t('settings.storage.autoSync.off')}</SelectItem>
											{SYNC_INTERVALS.map((interval) => (
												<SelectItem key={interval.key} value={interval.key}>
													{t(`settings.storage.autoSync.${interval.key}`)}
												</SelectItem>
											))}
											{intervalValue === 'custom' && (
												<SelectItem value="custom">
													{t('settings.storage.autoSync.custom')}
												</SelectItem>
											)}
										</SelectContent>
									</Select>
								}
							/>

							<SettingsRow
								title={t('settings.storage.autoSync.cronExpression')}
								description={t('settings.storage.autoSync.cronDescription')}
								actions={
									<Input
										value={storage.syncCronExpression}
										aria-label={t('settings.storage.autoSync.cronExpression')}
										className="w-56 max-w-full font-mono text-xs"
										disabled={!storage.syncEnabled || controlsDisabled}
										onChange={(event) =>
											updateDraft({ ...storage, syncCronExpression: event.target.value })
										}
									/>
								}
							/>
						</CardContent>

						<CardFooter className="flex-wrap justify-end gap-2 p-4!">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setRestoreOpen(true)}
								disabled={controlsDisabled || storage.paths.length === 0}
							>
								<Download className="size-3" />
								{runningOperation?.operation === 'restore'
									? t('settings.storage.pulling')
									: t('settings.storage.restore')}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => void runBackup()}
								disabled={controlsDisabled || storage.paths.length === 0}
							>
								<Upload className="size-3" />
								{runningOperation?.operation === 'backup'
									? t('settings.storage.pushing')
									: t('settings.storage.backup')}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setDraft(null)}
								disabled={!draft || controlsDisabled}
							>
								{t('settings.storage.cancel')}
							</Button>
							<Button
								size="sm"
								onClick={() => void saveSync()}
								disabled={!draft || controlsDisabled}
							>
								<Save className="size-3" />
								{savingSync ? t('settings.storage.saving') : t('settings.storage.sync.save')}
							</Button>
						</CardFooter>
					</Card>
					</SettingsSection>

					{syncStatus && <SettingsNotice icon={FolderSync}>{syncStatus}</SettingsNotice>}
					{operationStatusText && (
						<div
							role={
								operationStatus?.state === 'partial'
									? 'alert'
									: operationStatus?.state === 'failed'
										? undefined
										: 'status'
							}
							aria-live={operationNeedsAttention ? 'assertive' : 'polite'}
							aria-atomic="true"
						>
							<SettingsNotice
								icon={operationNeedsAttention ? AlertTriangle : FolderSync}
								variant={operationStatus?.state === 'failed' ? 'destructive' : 'default'}
								className={
									operationStatus?.state === 'partial'
										? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
										: undefined
								}
							>
								{operationStatusText}
							</SettingsNotice>
						</div>
					)}

					<Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>{t('settings.storage.restoreDialog.title')}</DialogTitle>
								<DialogDescription>
									{t('settings.storage.restoreDialog.description')}
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button variant="outline" onClick={() => setRestoreOpen(false)}>
									{t('settings.storage.cancel')}
								</Button>
								<Button
									disabled={controlsDisabled || storage.paths.length === 0}
									onClick={() => void runRestore()}
								>
									<Download className="size-3" />
									{t('settings.storage.restoreDialog.confirm')}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</>
			) : null}
		</SettingsPageShell>
	);
};

export default StoragePage;
