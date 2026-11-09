import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, FolderSync, Plus, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type {
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
import type { PluginScriptInfo } from '@shared/plugin_types';
import Service from './Service';
import Restore from './Restore';

const CloudPage: React.FC = () => {
	const { t } = useTranslation();
	const [settings, setSettings] = useState<StorageSyncSettings | null>(null);
	const [services, setServices] = useState<PluginScriptInfo[]>([]);
	const [providers, setProviders] = useState<StorageProvider[]>([]);
	const [nextRun, setNextRun] = useState<string>();
	const [cronInvalid, setCronInvalid] = useState(false);
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
			window.scripts.list(),
			window.storage.listProviders(),
			window.storage.getNextRun(),
		]).then(([settingsResult, statusResult, servicesResult, providersResult, nextRunResult]) => {
			if (cancelled) return;

			if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value);
			if (servicesResult.status === 'fulfilled')
				setServices(servicesResult.value.filter((script) => script.type === 'STORAGE'));
			if (providersResult.status === 'fulfilled') setProviders(providersResult.value);
			if (nextRunResult.status === 'fulfilled') setNextRun(nextRunResult.value);
			if (statusResult.status === 'fulfilled' && statusResult.value) {
				applyOperationStatus(statusResult.value);
			}

			const failed = [settingsResult, statusResult, servicesResult, providersResult].some(
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
	const selectedService = services.find((service) => service.name === storage?.serviceId);
	const selectedProvider = providers.find((provider) => provider.id === storage?.providerId);
	const runningOperation = operationStatus?.state === 'running' ? operationStatus : undefined;
	const intervalValue = !storage?.syncEnabled
		? 'off'
		: (SYNC_INTERVALS.find((interval) => interval.cron === storage.syncCronExpression)?.key ??
			'custom');
	const busy =
		settingsLoading || operationStatusLoading || operationStarting || Boolean(runningOperation);
	const controlsDisabled = busy || !selectedService || !selectedProvider;
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
					operationStatus?.error ||
					(operationStatus?.operation === 'backup'
						? t('settings.storage.errors.push')
						: t('settings.storage.errors.pull')),
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
				setNextRun(await window.storage.getNextRun());
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

	const updateDraft = (next: StorageSyncSettings): Promise<StorageSyncSettings | undefined> => {
		setDraft(next);
		setError(null);
		setSyncStatus(null);
		return persistSettings(next);
	};

	const pickFolders = async (): Promise<void> => {
		if (!storage) return;
		setError(null);
		try {
			const paths = await window.storage.pickFolders();
			if (paths.length > 0) {
				void updateDraft({ ...storage, paths: [...new Set([...storage.paths, ...paths])] });
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
		setCronInvalid(false);
		if (value === 'custom') return;
		if (value === 'off') {
			void updateDraft({ ...storage, syncEnabled: false });
			return;
		}
		const cron = SYNC_INTERVALS.find((interval) => interval.key === value)?.cron;
		void updateDraft({
			...storage,
			syncEnabled: true,
			syncCronExpression: cron ?? storage.syncCronExpression,
		});
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
					<SettingsSection
						title={t('settings.storage.sync.title')}
						description={t('settings.storage.sync.description')}
						action={
							<Button
								variant="outline"
								size="icon-sm"
								aria-label={t('settings.storage.sync.addFolders')}
								disabled={busy}
								onClick={() => void pickFolders()}
							>
								<Plus className="size-3" />
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
													void updateDraft({
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
								: t('settings.storage.backup')}
						</Button>
						<Button
							variant="outline"
							disabled={controlsDisabled || storage.paths.length === 0}
							onClick={() => setRestoreOpen(true)}
						>
							<Download className="size-3.5" />
							{runningOperation?.operation === 'restore'
								? t('settings.storage.pulling')
								: t('settings.storage.restore')}
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
												aria-invalid={cronInvalid}
												onBlur={() => {
													if (cronDraft !== undefined)
														void updateDraft({
															...storage,
															syncEnabled: true,
															syncCronExpression: cronDraft,
														}).then((saved) => {
															setCronInvalid(!saved);
															if (!saved) setError(null);
														});
												}}
											/>
										}
									/>
								)}
								{cronInvalid && (
									<SettingsRow
										title={
											<span className="text-destructive">
												{t('settings.storage.autoSync.invalidCron')}
											</span>
										}
									/>
								)}
								{storage.syncEnabled && nextRun && !cronInvalid && (
									<SettingsRow
										title={t('settings.storage.autoSync.nextRun')}
										description={new Date(nextRun).toLocaleString()}
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

					<Service
						services={services}
						value={storage.serviceId}
						provider={selectedProvider}
						disabled={busy}
						onChange={(serviceId) => void updateDraft({ ...storage, serviceId })}
					/>
					<Restore
						open={restoreOpen}
						onOpenChange={setRestoreOpen}
						disabled={controlsDisabled}
						hasFolders={storage.paths.length > 0}
						onRestore={() => void runRestore()}
					/>
				</>
			) : null}
		</SettingsPageShell>
	);
};

export default CloudPage;
