import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, LoaderCircle, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	SettingsNotice,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
	SettingsValue,
} from '../../components';
import { SETTINGS_SCHEDULES } from '../schedules';
import type { KnowledgeState } from './state';

export default function Indexing({ knowledge }: { knowledge: KnowledgeState }): JSX.Element {
	const { t, i18n } = useTranslation();
	const {
		configuration,
		status,
		disabled,
		running,
		cancelling,
		currentIndex,
		indexModelMatches,
		requirement,
		canIndex,
		save,
		runIndex,
		cancelIndex,
	} = knowledge;
	const selectedSchedule = SETTINGS_SCHEDULES.find(
		(schedule) => schedule.cron === configuration?.cronExpression
	);
	const scheduleValue = !configuration?.scheduleEnabled
		? 'off'
		: (selectedSchedule?.key ?? 'custom');
	const [customSchedule, setCustomSchedule] = useState(false);
	const [cron, setCron] = useState(configuration?.cronExpression ?? '');
	const [timezone, setTimezone] = useState(configuration?.timezone ?? status?.timezone ?? '');
	useEffect(() => {
		setCron(configuration?.cronExpression ?? '');
		setTimezone(configuration?.timezone ?? status?.timezone ?? '');
	}, [configuration, status?.timezone]);
	const outcome = running
		? 'running'
		: currentIndex && (!indexModelMatches || status?.requiresIndexing)
			? 'stale'
			: currentIndex && status?.outcome === 'idle'
				? 'completed'
				: status?.outcome === 'completed' && !currentIndex
					? 'idle'
					: (status?.outcome ?? 'idle');
	const finishedAt = status?.finishedAt ?? currentIndex?.completedAt;
	const format = { dateStyle: 'medium', timeStyle: 'short' } as const;
	return (
		<SettingsSection title={t('settings.knowledge.indexingTitle')}>
			<SettingsPanel>
				<SettingsRow
					title={t(`settings.knowledge.status.${outcome}`)}
					description={
						running
							? t(`settings.knowledge.trigger.${status?.trigger ?? 'manual'}`)
							: status?.result
								? t('settings.knowledge.indexResult', status.result)
								: t('settings.knowledge.indexDescription')
					}
					icon={Clock3}
					media={
						running ? (
							<LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
						) : undefined
					}
					actions={
						running ? (
							<Button
								variant="outline"
								size="sm"
								disabled={cancelling}
								onClick={() => void cancelIndex()}
							>
								<Square className="size-3" />
								{t(cancelling ? 'settings.knowledge.cancelling' : 'settings.knowledge.cancel')}
							</Button>
						) : (
							<Button size="sm" disabled={!canIndex} onClick={() => void runIndex()}>
								<Play className="size-3" />
								{t('settings.knowledge.index')}
							</Button>
						)
					}
				/>
				{currentIndex && (
					<SettingsRow
						title={t('settings.knowledge.activeIndex')}
						description={`${currentIndex.providerId} / ${currentIndex.modelId}`}
						actions={
							<SettingsValue>
								{t('settings.knowledge.dimensions', { count: currentIndex.dimensions })}
							</SettingsValue>
						}
					/>
				)}
				{finishedAt && (
					<SettingsRow
						title={t('settings.knowledge.lastRun')}
						actions={
							<SettingsValue>
								{new Date(finishedAt).toLocaleString(i18n?.language, format)}
							</SettingsValue>
						}
					/>
				)}
				<SettingsRow
					title={t('settings.knowledge.scheduleFrequency')}
					description={t('settings.knowledge.scheduleDescription')}
					actions={
						<Select
							value={customSchedule ? 'custom' : scheduleValue}
							disabled={disabled}
							onValueChange={(value) => {
								if (value === 'custom') {
									setCustomSchedule(true);
									void save({ scheduleEnabled: true, cronExpression: cron });
									return;
								}
								setCustomSchedule(false);
								if (value === 'off') {
									void save({ scheduleEnabled: false });
									return;
								}
								const schedule = SETTINGS_SCHEDULES.find((item) => item.key === value);
								if (schedule) void save({ scheduleEnabled: true, cronExpression: schedule.cron });
							}}
						>
							<SelectTrigger
								aria-label={t('settings.knowledge.scheduleFrequency')}
								size="sm"
								className="w-64 max-w-full text-xs"
							>
								<SelectValue>
									{t(
										`settings.knowledge.scheduleOptions.${customSchedule ? 'custom' : scheduleValue}`
									)}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="off">{t('settings.knowledge.scheduleOptions.off')}</SelectItem>
								{SETTINGS_SCHEDULES.map((schedule) => (
									<SelectItem key={schedule.key} value={schedule.key}>
										{t(`settings.knowledge.scheduleOptions.${schedule.key}`)}
									</SelectItem>
								))}
								<SelectItem value="custom">
									{t('settings.knowledge.scheduleOptions.custom')}
								</SelectItem>
							</SelectContent>
						</Select>
					}
				/>
				{(customSchedule || scheduleValue === 'custom') && (
					<SettingsRow
						title={t('settings.knowledge.cronExpression')}
						description={t('settings.knowledge.cronDescription')}
						actions={
							<Input
								value={cron}
								aria-label={t('settings.knowledge.cronExpression')}
								className="w-64 max-w-full font-mono text-xs"
								disabled={disabled}
								onChange={(event) => setCron(event.target.value)}
								onBlur={() => {
									if (cron !== configuration?.cronExpression || customSchedule)
										void save({ scheduleEnabled: true, cronExpression: cron });
								}}
							/>
						}
					/>
				)}
				{(configuration?.scheduleEnabled || customSchedule) && (
					<SettingsRow
						title={t('settings.knowledge.timezone')}
						actions={
							<Input
								value={timezone}
								aria-label={t('settings.knowledge.timezone')}
								className="w-64 max-w-full text-xs"
								disabled={disabled}
								onChange={(event) => setTimezone(event.target.value)}
								onBlur={() => {
									if (timezone !== configuration?.timezone) void save({ timezone });
								}}
							/>
						}
					/>
				)}
				{status?.nextRunAt && (
					<SettingsRow
						title={t('settings.knowledge.nextRun')}
						actions={
							<SettingsValue>
								{new Date(status.nextRunAt).toLocaleString(i18n?.language, {
									...format,
									timeZone: status.timezone,
								})}
							</SettingsValue>
						}
					/>
				)}
			</SettingsPanel>
			<div aria-live="polite" aria-atomic="true">
				{status?.error && <SettingsNotice variant="destructive">{status.error}</SettingsNotice>}
				{requirement && (
					<SettingsNotice>{t(`settings.knowledge.requirements.${requirement}`)}</SettingsNotice>
				)}
				{currentIndex && !indexModelMatches && (
					<SettingsNotice>{t('settings.knowledge.modelChanged')}</SettingsNotice>
				)}
				{currentIndex && indexModelMatches && status?.requiresIndexing && (
					<SettingsNotice>{t('settings.knowledge.configurationChanged')}</SettingsNotice>
				)}
			</div>
		</SettingsSection>
	);
}
