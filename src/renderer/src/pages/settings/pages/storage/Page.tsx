import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, FolderSync, Plus, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
	StorageConflict,
	StorageOperationStatus,
	StorageProvider,
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

const StoragePage: React.FC = () => {
	const { t } = useTranslation();
	const [settings, setSettings] = useState<StorageSyncSettings | null>(null);
	const [versionedEnabled, setVersionedEnabled] = useState(false);
	const [conflicts, setConflicts] = useState<StorageConflict[]>([]);
	const [providers, setProviders] = useState<StorageProvider[]>([]);
	const [settingsLoading, setSettingsLoading] = useState(true);
	const [draft, setDraft] = useState<StorageSyncSettings | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [syncStatus, setSyncStatus] = useState<string | null>(null);
	const saveQueueRef = useRef(Promise.resolve());
	const [operationStatus, setOperationStatus] = useState<StorageOperationStatus>();
	const [operationStatusLoading, setOperationStatusLoading] = useState(true);
	const [restoreOpen, setRestoreOpen] = useState(false);
	const [operationStarting, setOperationStarting] = useState(false);
	const [customSchedule, setCustomSchedule] = useState(false);
	const [cronDraft, setCronDraft] = useState<string>();
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
			window.storage.getOperationStatus(),
			window.storage.listProviders(),
			window.storage.getVersionedStatus(),
			window.storage.listConflicts(),
		]).then(([settingsResult, statusResult, providersResult, versionedResult, conflictsResult]) => {
			if (cancelled) return;

			if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value);
			if (providersResult.status === 'fulfilled') setProviders(providersResult.value);
			if (versionedResult.status === 'fulfilled') setVersionedEnabled(versionedResult.value);
			if (conflictsResult.status === 'fulfilled') setConflicts(conflictsResult.value);
			if (statusResult.status === 'fulfilled' && statusResult.value) {
				applyOperationStatus(statusResult.value);
			}

			const failed = [
				settingsResult,
				statusResult,
				providersResult,
				versionedResult,
				conflictsResult,
			].some((result) => result.status === 'rejected');
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

	useEffect(() => {
		if (!versionedEnabled || !operationStatus || operationStatus.state === 'running') return;
		void window.storage
			.listConflicts()
			.then(setConflicts)
			.catch(() => undefined);
	}, [versionedEnabled, operationStatus?.revision, operationStatus?.state]);

	const storage = draft ?? settings;
	const selectedProvider = providers.find((provider) => provider.id === storage?.providerId);
	const runningOperation = operationStatus?.state === 'running' ? operationStatus : undefined;
	const intervalValue = !storage?.syncEnabled
		? 'off'
		: (SYNC_INTERVALS.find((interval) => interval.cron === storage.syncCronExpression)?.key ??
			'custom');
	const busy =
		settingsLoading || operationStatusLoading || operationStarting || Boolean(runningOperation);
	const controlsDisabled = busy || !selectedProvider;
	const operationStatusKey = operationStatus
		? operationStatus.state === 'running' && operationStatus.trigger === 'scheduled'
			? `settings.storage.operation.${operationStatus.operation}.scheduledRunning`
			: versionedEnabled
				? `settings.storage.versioned.${operationStatus.operation}.${operationStatus.state}`
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

	const persistSettings = (next: StorageSyncSettings): Promise<StorageSyncSettings | undefined> => {
		const save = async (): Promise<StorageSyncSettings | undefined> => {
			try {
				const saved = await window.storage.saveSettings(next);
				setSettings(saved);
				setDraft((current) => (current === next ? null : current));
				setSyncStatus(t('settings.storage.syncSaved'));
				return saved;
			} catch {
				setError(t('settings.storage.errors.saveSync'));
				return undefined;
			}
		};
		const queued = saveQueueRef.current.then(save, save);
		saveQueueRef.current = queued.then(
			() => undefined,
			() => undefined
		);
		return queued;
	};

	const updateDraft = (next: StorageSyncSettings): void => {
		setDraft(next);
		setError(null);
		setSyncStatus(null);
		void persistSettings(next);
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

	const runBackup = async (): Promise<void> => {
		setOperationStarting(true);
		setError(null);
		setSyncStatus(null);
		try {
			if (!storage || !(await persistSettings(storage))) return;
			applyOperationStatus(await window.storage.backup());
		} catch {
			setError(t('settings.storage.errors.push'));
		} finally {
			setOperationStarting(false);
		}
	};

	const runRestore = async (): Promise<void> => {
		setOperationStarting(true);
		setRestoreOpen(false);
		setError(null);
		setSyncStatus(null);
		try {
			if (!storage || !(await persistSettings(storage))) return;
			applyOperationStatus(await window.storage.restore());
		} catch {
			setError(t('settings.storage.errors.pull'));
		} finally {
			setOperationStarting(false);
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
		setCustomSchedule(value === 'custom');
		setCronDraft(undefined);
		if (value === 'custom') return;
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

	const setVersionHistory = async (enabled: boolean): Promise<void> => {
		setError(null);
		try {
			await saveQueueRef.current;
			setVersionedEnabled(await window.storage.setVersionedEnabled(enabled));
			setConflicts(enabled ? await window.storage.listConflicts() : []);
		} catch {
			setError(t('settings.storage.errors.versioned'));
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.storage')}
				description={t('settings.overview.descriptions.storage')}
			/>

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
								size="sm"
								disabled={busy}
								onClick={() => void pickFolders()}
							>
								<Plus className="size-3" />
								{t('settings.storage.sync.addFolders')}
							</Button>
						}
					>
						<Card size="sm" className="gap-0! py-0!" aria-busy={Boolean(runningOperation)}>
							<CardContent className="p-0!">
								{storage.paths.length === 0 && (
									<SettingsRow title={t('settings.storage.sync.empty')} />
								)}
								{storage.paths.map((selectedPath) => (
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
												disabled={busy}
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
							</CardContent>
						</Card>
					</SettingsSection>

					<div className="flex flex-wrap items-center gap-2">
						<Button
							disabled={controlsDisabled || storage.paths.length === 0}
							onClick={() => void runBackup()}
						>
							<Upload className="size-3.5" />
							{runningOperation?.operation === 'backup'
								? t('settings.storage.pushing')
								: t(
										versionedEnabled
											? 'settings.storage.versioned.syncNow'
											: 'settings.storage.backup'
									)}
						</Button>
						<Button
							variant="outline"
							disabled={controlsDisabled || storage.paths.length === 0}
							onClick={() => setRestoreOpen(true)}
						>
							<Download className="size-3.5" />
							{runningOperation?.operation === 'restore'
								? t('settings.storage.pulling')
								: t(
										versionedEnabled
											? 'settings.storage.versioned.catchUp'
											: 'settings.storage.restore'
									)}
						</Button>
					</div>
					<SettingsSection
						title={t('settings.storage.autoSync.sectionTitle')}
						description={t('settings.storage.autoSync.sectionDescription')}
					>
						<Card size="sm" className="gap-0! py-0!" aria-busy={Boolean(runningOperation)}>
							<CardContent className="p-0!">
								<SettingsRow
									title={t('settings.storage.autoSync.interval')}
									description={t('settings.storage.autoSync.description')}
									actions={
										<Select
											value={customSchedule ? 'custom' : intervalValue}
											onValueChange={selectInterval}
											disabled={controlsDisabled}
										>
											<SelectTrigger
												size="sm"
												className="w-56 max-w-full text-xs"
												aria-label={t('settings.storage.autoSync.interval')}
											>
												<SelectValue>
													{t(
														`settings.storage.autoSync.${customSchedule ? 'custom' : intervalValue}`
													)}
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="off">{t('settings.storage.autoSync.off')}</SelectItem>
												{SYNC_INTERVALS.map((interval) => (
													<SelectItem key={interval.key} value={interval.key}>
														{t(`settings.storage.autoSync.${interval.key}`)}
													</SelectItem>
												))}
												{
													<SelectItem value="custom">
														{t('settings.storage.autoSync.custom')}
													</SelectItem>
												}
											</SelectContent>
										</Select>
									}
								/>

								{(customSchedule || intervalValue === 'custom') && (
									<SettingsRow
										title={t('settings.storage.autoSync.cronExpression')}
										description={t('settings.storage.autoSync.cronDescription')}
										actions={
											<Input
												value={cronDraft ?? storage.syncCronExpression}
												aria-label={t('settings.storage.autoSync.cronExpression')}
												className="w-56 max-w-full font-mono text-xs"
												disabled={controlsDisabled}
												onChange={(event) => setCronDraft(event.target.value)}
												onBlur={() => {
													if (cronDraft !== undefined)
														updateDraft({
															...storage,
															syncEnabled: true,
															syncCronExpression: cronDraft,
														});
												}}
											/>
										}
									/>
								)}
							</CardContent>
						</Card>
					</SettingsSection>

					{syncStatus && (
						<SettingsNotice autoDismiss icon={FolderSync}>
							{syncStatus}
						</SettingsNotice>
					)}
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
								autoDismiss={operationStatus?.state === 'succeeded'}
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

					<details className="group">
						<summary className="cursor-pointer text-sm font-medium text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
							{t('settings.storage.versioned.title')}
						</summary>
						<div className="mt-4 grid gap-4">
							<SettingsSection
								title={t('settings.storage.versioned.title')}
								description={t('settings.storage.versioned.description')}
							>
								<Card size="sm" className="gap-0! py-0!">
									<CardContent className="p-0!">
										<SettingsRow
											title={t('settings.storage.versioned.enable')}
											description={t('settings.storage.versioned.enableDescription')}
											actions={
												<Switch
													checked={versionedEnabled}
													aria-label={t('settings.storage.versioned.enable')}
													disabled={busy || !selectedProvider || storage.paths.length === 0}
													onCheckedChange={(enabled) => void setVersionHistory(enabled)}
												/>
											}
										/>
									</CardContent>
								</Card>
							</SettingsSection>
							{versionedEnabled && conflicts.length > 0 && (
								<SettingsSection
									title={t('settings.storage.versioned.conflicts')}
									description={t('settings.storage.versioned.conflictsDescription')}
								>
									<Card size="sm" className="gap-0! py-0!">
										<CardContent className="p-0!">
											{conflicts.map((conflict) => (
												<SettingsRow
													key={`${conflict.workspaceId}:${conflict.versionId}`}
													title={conflict.path ?? t('settings.storage.versioned.deleted')}
													description={`${conflict.kind} · ${conflict.versionId}`}
												/>
											))}
										</CardContent>
									</Card>
								</SettingsSection>
							)}
						</div>
					</details>

					<Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>
									{t(
										versionedEnabled
											? 'settings.storage.versioned.catchUp'
											: 'settings.storage.restoreDialog.title'
									)}
								</DialogTitle>
								<DialogDescription>
									{t(
										versionedEnabled
											? 'settings.storage.versioned.catchUpDescription'
											: 'settings.storage.restoreDialog.description'
									)}
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
									{t(
										versionedEnabled
											? 'settings.storage.versioned.catchUp'
											: 'settings.storage.restoreDialog.confirm'
									)}
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
