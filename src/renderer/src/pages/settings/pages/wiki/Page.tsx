import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, FolderOpen, LoaderCircle, Play, Save, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
	llmProviderGroups,
	ModelProviderSelect,
	resolveStoredModelProvider,
} from '@/components/model-provider-select';
import type { WikiRunResult, WikiSettings, WikiStatus } from '../../../../../../shared';
import {
	SettingsField,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
	SettingsValue,
} from '../../components';
import { SETTINGS_SCHEDULES } from '../schedules';
import { DataControls } from '../../components/data';

const WIKI_ITEM_CLASS = 'px-4 py-3 flex-nowrap border-b border-border/60 last:border-b-0';

const WikiPage: React.FC = () => {
	const { t } = useTranslation();
	const [settings, setSettings] = useState<WikiSettings | null>(null);
	const [status, setStatus] = useState<WikiStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [running, setRunning] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [saved, setSaved] = useState(false);
	const [result, setResult] = useState<WikiRunResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const cancelRequested = useRef(false);

	useEffect(() => {
		let mounted = true;
		void Promise.all([window.wiki.getSettings(), window.wiki.getStatus()])
			.then(([stored, currentStatus]) => {
				if (!mounted) return;
				const selection = resolveStoredModelProvider(
					llmProviderGroups(),
					stored.providerId,
					stored.modelId
				);
				setSettings({ ...stored, ...selection });
				setStatus(currentStatus);
				setRunning(currentStatus.running);
			})
			.catch((loadError: unknown) => {
				if (mounted) {
					setError(loadError instanceof Error ? loadError.message : t('settings.wiki.loadError'));
				}
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, [t]);

	useEffect(() => {
		if (!running) return;
		let mounted = true;
		const refreshStatus = async (): Promise<void> => {
			const next = await window.wiki.getStatus();
			if (!mounted) return;
			setStatus(next);
			if (!next.running) {
				setRunning(false);
				setCancelling(false);
			}
		};
		void refreshStatus().catch(() => undefined);
		const interval = window.setInterval(() => {
			void refreshStatus().catch(() => undefined);
		}, 750);
		return () => {
			mounted = false;
			window.clearInterval(interval);
		};
	}, [running]);

	const handleSave = async (): Promise<WikiSettings | undefined> => {
		if (!settings) return undefined;
		setSaving(true);
		setSaved(false);
		setError(null);
		try {
			const next = await window.wiki.saveSettings(settings);
			setSettings(next);
			setStatus(await window.wiki.getStatus());
			setSaved(true);
			return next;
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : t('settings.wiki.saveError'));
			return undefined;
		} finally {
			setSaving(false);
		}
	};

	const handleRun = async (): Promise<void> => {
		cancelRequested.current = false;
		setCancelling(false);
		setRunning(true);
		setResult(null);
		setError(null);
		try {
			if (!(await handleSave())) return;
			const next = await window.wiki.run();
			setResult(next);
			setStatus(await window.wiki.getStatus());
		} catch (runError) {
			if (!cancelRequested.current) {
				setError(runError instanceof Error ? runError.message : t('settings.wiki.runError'));
			}
		} finally {
			setRunning(false);
			setCancelling(false);
		}
	};

	const handleCancel = async (): Promise<void> => {
		cancelRequested.current = true;
		setCancelling(true);
		try {
			const accepted = await window.wiki.cancel();
			if (!accepted) {
				setRunning(false);
				setCancelling(false);
				setStatus(await window.wiki.getStatus());
			}
		} catch (cancelError) {
			cancelRequested.current = false;
			setCancelling(false);
			setError(cancelError instanceof Error ? cancelError.message : t('settings.wiki.cancelError'));
		}
	};

	const handlePickDirectory = async (kind: 'source' | 'target'): Promise<void> => {
		const selected = await window.wiki.pickDirectory(kind);
		if (!selected) return;
		setSettings((current) =>
			current
				? {
						...current,
						[kind === 'source' ? 'sourcePath' : 'targetPath']: selected,
					}
				: current
		);
		setSaved(false);
	};

	const selectedSchedule = SETTINGS_SCHEDULES.find(
		(schedule) => schedule.cron === settings?.schedule.cronExpression
	);
	const scheduleValue = !settings?.schedule.enabled ? 'off' : (selectedSchedule?.key ?? 'custom');
	const scheduleLabel = selectedSchedule
		? t(`settings.wiki.scheduleOptions.${selectedSchedule.key}`)
		: t(`settings.wiki.scheduleOptions.${scheduleValue}`);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.wiki.title')}
				description={t('settings.wiki.description')}
				action={
					<>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={!settings || saving || running}
							onClick={() => void handleSave()}
						>
							{saving ? (
								<LoaderCircle className="size-3 animate-spin" />
							) : (
								<Save className="size-3" />
							)}
							{t('common.save')}
						</Button>
						{running ? (
							<Button
								type="button"
								size="sm"
								variant="destructive"
								disabled={cancelling}
								onClick={() => void handleCancel()}
							>
								{cancelling ? (
									<LoaderCircle className="size-3 animate-spin" />
								) : (
									<Square className="size-3" />
								)}
								{cancelling ? t('settings.wiki.cancelling') : t('common.cancel')}
							</Button>
						) : (
							<Button
								type="button"
								size="sm"
								disabled={!settings || settings.enabled === false || saving}
								onClick={() => void handleRun()}
							>
								<Play className="size-3" />
								{t('settings.wiki.runNow')}
							</Button>
						)}
					</>
				}
			/>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{running && status?.progress && (
				<SettingsNotice>
					{t(`settings.wiki.progress.${status.progress.phase}`, {
						current: status.progress.currentSource,
						total: status.progress.totalSources,
						source: status.progress.source,
					})}
				</SettingsNotice>
			)}
			{saved && <SettingsNotice autoDismiss>{t('settings.wiki.saved')}</SettingsNotice>}
			{result && (
				<SettingsNotice autoDismiss>
					{t('settings.wiki.runResult', {
						processed: result.processedSources,
						skipped: result.skippedSources,
						created: result.createdPages,
						updated: result.updatedPages,
					})}
				</SettingsNotice>
			)}

			{loading || !settings ? (
				<SettingsPanel>
					<SettingsLoadingRows rows={4} />
				</SettingsPanel>
			) : (
				<>
					<SettingsSection
						title={t('settings.wiki.behaviorTitle')}
						description={t('settings.wiki.behaviorDescription')}
					>
						<SettingsPanel>
							<Item variant="outline" size="sm" className={WIKI_ITEM_CLASS}>
								<ItemContent className="min-w-0 flex-col items-start gap-0.5">
									<ItemTitle className="max-w-full line-clamp-none">
										{t('settings.wiki.enabled')}
									</ItemTitle>
									<p className="text-[11px] leading-4 text-muted-foreground">
										{t('settings.wiki.enabledDescription')}
									</p>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<Switch
										checked={settings.enabled !== false}
										disabled={saving || running}
										aria-label={t('settings.wiki.enabled')}
										onCheckedChange={(enabled) => {
											setSettings({ ...settings, enabled });
											setSaved(false);
										}}
									/>
								</ItemActions>
							</Item>
							<Item variant="outline" size="sm" className={WIKI_ITEM_CLASS}>
								<ItemContent className="min-w-0 flex-col items-start gap-0.5">
									<ItemTitle className="max-w-full line-clamp-none">
										{t('settings.wiki.autoFileAnswers')}
									</ItemTitle>
									<p className="text-[11px] leading-4 text-muted-foreground">
										{t('settings.wiki.autoFileAnswersDescription')}
									</p>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<Switch
										checked={settings.autoFileAnswers === true}
										disabled={saving || running}
										aria-label={t('settings.wiki.autoFileAnswers')}
										onCheckedChange={(autoFileAnswers) => {
											setSettings({ ...settings, autoFileAnswers });
											setSaved(false);
										}}
									/>
								</ItemActions>
							</Item>
							<Item variant="outline" size="sm" className={WIKI_ITEM_CLASS}>
								<ItemContent className="min-w-0 flex-col items-start gap-0.5">
									<ItemTitle className="max-w-full line-clamp-none">
										{t('settings.wiki.requireReview')}
									</ItemTitle>
									<p className="text-[11px] leading-4 text-muted-foreground">
										{t('settings.wiki.requireReviewDescription')}
									</p>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<Switch
										checked={settings.requireReviewForMajorChanges !== false}
										disabled={saving || running}
										aria-label={t('settings.wiki.requireReview')}
										onCheckedChange={(requireReviewForMajorChanges) => {
											setSettings({ ...settings, requireReviewForMajorChanges });
											setSaved(false);
										}}
									/>
								</ItemActions>
							</Item>
							<Item variant="outline" size="sm" className={WIKI_ITEM_CLASS}>
								<ItemContent className="min-w-0 flex-col items-start gap-0.5">
									<ItemTitle className="max-w-full line-clamp-none">
										{t('settings.wiki.lintOnStartup')}
									</ItemTitle>
									<p className="text-[11px] leading-4 text-muted-foreground">
										{t('settings.wiki.lintOnStartupDescription')}
									</p>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<Switch
										checked={settings.lintOnStartup === true}
										disabled={saving || running}
										aria-label={t('settings.wiki.lintOnStartup')}
										onCheckedChange={(lintOnStartup) => {
											setSettings({ ...settings, lintOnStartup });
											setSaved(false);
										}}
									/>
								</ItemActions>
							</Item>
						</SettingsPanel>
					</SettingsSection>

					<SettingsSection title={t('settings.wiki.configurationTitle')}>
						<SettingsPanel>
							<div className="grid gap-4 p-4">
								<ModelProviderSelect
									idPrefix="wiki"
									providerGroups={llmProviderGroups()}
									providerId={settings.providerId}
									modelId={settings.modelId}
									onChange={(providerId, modelId) => {
										setSettings((current) =>
											current ? { ...current, providerId, modelId } : current
										);
										setSaved(false);
									}}
									disabled={saving || running}
									labels={{
										label: t('settings.wiki.modelTitle'),
										description: t('settings.wiki.modelDescription'),
									}}
								/>

								<SettingsField
									id="wiki-source"
									label={t('settings.wiki.sourcePath')}
									description={t('settings.wiki.sourceDescription')}
								>
									<div className="flex min-w-0 gap-2">
										<Input
											id="wiki-source"
											value={settings.sourcePath}
											disabled={saving || running}
											onChange={(event) => {
												setSettings({ ...settings, sourcePath: event.target.value });
												setSaved(false);
											}}
										/>
										<Button
											type="button"
											size="icon-sm"
											variant="outline"
											aria-label={t('settings.wiki.pickSource')}
											disabled={saving || running}
											onClick={() => void handlePickDirectory('source')}
										>
											<FolderOpen className="size-3" />
										</Button>
									</div>
								</SettingsField>

								<SettingsField
									id="wiki-target"
									label={t('settings.wiki.targetPath')}
									description={t('settings.wiki.targetDescription')}
								>
									<div className="flex min-w-0 gap-2">
										<Input
											id="wiki-target"
											value={settings.targetPath}
											disabled={saving || running}
											onChange={(event) => {
												setSettings({ ...settings, targetPath: event.target.value });
												setSaved(false);
											}}
										/>
										<Button
											type="button"
											size="icon-sm"
											variant="outline"
											aria-label={t('settings.wiki.pickTarget')}
											disabled={saving || running}
											onClick={() => void handlePickDirectory('target')}
										>
											<FolderOpen className="size-3" />
										</Button>
									</div>
								</SettingsField>
							</div>
						</SettingsPanel>
					</SettingsSection>

					<SettingsSection title={t('settings.wiki.scheduleTitle')}>
						<SettingsPanel>
							<SettingsRow
								title={t('settings.wiki.scheduleFrequency')}
								description={t('settings.wiki.scheduleDescription')}
								actions={
									<Select
										value={scheduleValue}
										disabled={settings.enabled === false || saving || running}
										onValueChange={(value) => {
											if (!value) return;
											if (value === 'off') {
												setSettings({
													...settings,
													schedule: { ...settings.schedule, enabled: false },
												});
												setSaved(false);
												return;
											}
											const schedule = SETTINGS_SCHEDULES.find((entry) => entry.key === value);
											if (!schedule) return;
											setSettings({
												...settings,
												schedule: {
													...settings.schedule,
													enabled: true,
													cronExpression: schedule.cron,
												},
											});
											setSaved(false);
										}}
									>
										<SelectTrigger
											size="sm"
											className="w-44 max-w-full text-xs"
											aria-label={t('settings.wiki.scheduleFrequency')}
										>
											<SelectValue>{scheduleLabel}</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="off">{t('settings.wiki.scheduleOptions.off')}</SelectItem>
											{SETTINGS_SCHEDULES.map((schedule) => (
												<SelectItem key={schedule.key} value={schedule.key}>
													{t(`settings.wiki.scheduleOptions.${schedule.key}`)}
												</SelectItem>
											))}
											{scheduleValue === 'custom' && (
												<SelectItem value="custom">
													{t('settings.wiki.scheduleOptions.custom')}
												</SelectItem>
											)}
										</SelectContent>
									</Select>
								}
							/>
						</SettingsPanel>
					</SettingsSection>

					<SettingsSection title={t('settings.wiki.statusTitle')}>
						<SettingsPanel>
							<Item variant="outline" size="sm" className={WIKI_ITEM_CLASS}>
								<ItemContent className="min-w-0">
									<ItemTitle>{t('settings.wiki.settingsFile')}</ItemTitle>
								</ItemContent>
								<ItemActions className="ml-auto min-w-0 max-w-[60%] flex-none justify-end">
									<SettingsValue mono>{status?.settingsPath ?? '—'}</SettingsValue>
								</ItemActions>
							</Item>
							<Item variant="outline" size="sm" className={WIKI_ITEM_CLASS}>
								<ItemContent className="min-w-0">
									<ItemTitle>{t('settings.wiki.pendingReviews')}</ItemTitle>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<SettingsValue>{status?.pendingReviews ?? 0}</SettingsValue>
								</ItemActions>
							</Item>
							<Item variant="outline" size="sm" className={WIKI_ITEM_CLASS}>
								<ItemContent className="min-w-0">
									<ItemTitle>{t('settings.wiki.nextRun')}</ItemTitle>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<SettingsValue>
										{status?.nextRunAt
											? new Date(status.nextRunAt).toLocaleString()
											: t('settings.wiki.notScheduled')}
									</SettingsValue>
								</ItemActions>
							</Item>
							<Item variant="outline" size="sm" className={WIKI_ITEM_CLASS}>
								<ItemContent className="min-w-0">
									<ItemTitle>{t('settings.wiki.lastRun')}</ItemTitle>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<SettingsValue>
										{status?.lastRun
											? new Date(status.lastRun.completedAt).toLocaleString()
											: t('settings.wiki.neverRun')}
									</SettingsValue>
								</ItemActions>
							</Item>
							<Item variant="outline" size="sm" className={WIKI_ITEM_CLASS}>
								<ItemContent className="min-w-0">
									<ItemTitle>{t('settings.wiki.outputFolder')}</ItemTitle>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => void window.wiki.openDirectory('target')}
									>
										<FolderOpen className="size-3" />
										{t('settings.wiki.openOutput')}
									</Button>
								</ItemActions>
							</Item>
						</SettingsPanel>
					</SettingsSection>
				</>
			)}

			<SettingsSection title={t('settings.dataControls.title')}>
				<DataControls kinds={['wiki']} />
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default WikiPage;
