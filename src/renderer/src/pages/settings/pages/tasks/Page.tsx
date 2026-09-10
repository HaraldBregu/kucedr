import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BrainCircuit, ListChecks } from 'lucide-react';
import { Item, ItemContent, ItemTitle } from '@/components/ui/item';
import { Switch } from '@/components/ui/switch';
import { ModelOptions } from '@/components/model-options';
import { updateModelOptions } from '@/lib/options';
import { modelsFor, providerIdsFor, providerModels, providers } from '@/lib/providers';
import type { ProviderModelGroup } from '../../../start/setupTypes';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';
import { ModelProviderConfiguration } from '../../components/model-configuration';

type Task = Awaited<ReturnType<typeof window.tasks.list>>[number];

function describeAction(task: Task): string {
	return task.action.type === 'agent' ? task.action.prompt : task.action.message;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function describeSchedule(expression: string | undefined, t: Translate): string {
	if (!expression) return t('settings.cron.schedule.notScheduled');
	const fields = expression.trim().split(/\s+/);
	if (fields.length === 6 && fields[0] === '0') fields.shift();
	if (fields.length !== 5) return expression;

	const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
	const time =
		hour !== '*' && minute !== '*' ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : '';
	if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
		return t('settings.cron.schedule.everyMinute');
	}
	if (
		/^\*\/\d+$/.test(minute) &&
		hour === '*' &&
		dayOfMonth === '*' &&
		month === '*' &&
		dayOfWeek === '*'
	) {
		return t('settings.cron.schedule.everyMinutes', { count: minute.slice(2) });
	}
	if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
		return t('settings.cron.schedule.everyHour');
	}
	if (
		/^\*\/\d+$/.test(hour) &&
		minute === '0' &&
		dayOfMonth === '*' &&
		month === '*' &&
		dayOfWeek === '*'
	) {
		return t('settings.cron.schedule.everyHours', { count: hour.slice(2) });
	}
	if (dayOfMonth === '1' && month === '*' && dayOfWeek === '*') {
		return time
			? t('settings.cron.schedule.monthlyAt', { time })
			: t('settings.cron.schedule.monthly');
	}
	if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
		return time ? t('settings.cron.schedule.dailyAt', { time }) : t('settings.cron.schedule.daily');
	}
	return expression;
}

function taskModelGroups(): ProviderModelGroup[] {
	return providerIdsFor('llm').flatMap((providerId) => {
		const provider = providers().find((item) => item.id === providerId);
		const models = providerModels(providerId, 'llm');
		return provider && models.length > 0 ? [{ provider, models }] : [];
	});
}

const TasksPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [providerId, setProviderId] = useState('');
	const [modelId, setModelId] = useState('');
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [runtimeError, setRuntimeError] = useState<string | null>(null);
	const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
	const [modelOptions, setModelOptions] = useState<Record<string, unknown>>({});

	const modelGroups = taskModelGroups();
	const model = modelsFor('llm').find(
		(item) => item.provider.id === providerId && item.id === modelId
	);
	const inputs = model?.metadata?.documentationStatus === 'verified' ? model.metadata.inputs : {};

	useEffect(() => {
		let mounted = true;
		void Promise.all([
			window.tasks.list(),
			window.tasks.getRuntime(),
			window.agent.getModelOptions(),
		])
			.then(([list, runtime, options]) => {
				if (!mounted) return;
				setTasks(list);
				const groups = taskModelGroups();
				const group = groups.find((item) => item.provider.id === runtime?.providerId) ?? groups[0];
				const model =
					group?.models.find((item) => item.id === runtime?.modelId) ?? group?.models[0];
				setProviderId(group?.provider.id ?? '');
				setModelId(model?.id ?? '');
				setModelOptions(options);
			})
			.catch((err: unknown) => {
				if (mounted) setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, []);

	const handleChange = async (nextProviderId: string, nextModelId: string): Promise<void> => {
		setProviderId(nextProviderId);
		setModelId(nextModelId);
		setModelOptions({});
		setSaving(true);
		setSaved(false);
		setRuntimeError(null);
		try {
			await window.tasks.setRuntime(nextProviderId, nextModelId);
			await window.agent.setModelOptions({});
			setSaved(true);
		} catch (err) {
			setRuntimeError(
				err instanceof Error ? err.message : t('settings.cron.runtime.errors.saveFailed')
			);
		} finally {
			setSaving(false);
		}
	};

	const saveModelOptions = (next: Record<string, unknown>): void => {
		setModelOptions(next);
		void window.agent.setModelOptions(next);
	};

	const updateModelOption = (path: readonly string[], value: unknown): void => {
		saveModelOptions(updateModelOptions(modelOptions, path, value));
	};

	const handleTaskEnabledChange = async (taskId: string, enabled: boolean): Promise<void> => {
		setTogglingTaskId(taskId);
		setError(null);
		try {
			const updatedTask = await window.tasks.setEnabled(taskId, enabled);
			setTasks((current) => current.map((task) => (task.id === taskId ? updatedTask : task)));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setTogglingTaskId(null);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.taskScheduler')}
				description={t('settings.cron.description')}
			/>

			<SettingsPanel>
				<ModelProviderConfiguration
					configState={{
						providers: modelGroups.map((group) => group.provider),
						modelGroups,
						providerId,
						modelId,
						loading,
						loadingModels: false,
						saving,
						saved,
						error: runtimeError,
					}}
					idPrefix="task-runtime"
					triggerTitle={t('settings.modelServices.llmModel')}
					description={t('settings.modelServices.modelDescription')}
					showInlineError
					showIcon
					icon={BrainCircuit}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					onChange={(nextProviderId, nextModelId) => void handleChange(nextProviderId, nextModelId)}
				>
					<ModelOptions
						key={`${providerId}:${modelId}`}
						inputs={inputs}
						values={modelOptions}
						inlineAdvanced
						onChange={updateModelOption}
					/>
				</ModelProviderConfiguration>
			</SettingsPanel>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}

			<SettingsSection
				title={t('settings.cron.schedulesTitle')}
				description={t('settings.cron.schedulesDescription')}
			>
				<SettingsPanel>
					{loading ? (
						<SettingsLoadingRows rows={2} />
					) : tasks.length === 0 ? (
						<SettingsEmptyState
							icon={ListChecks}
							title={t('settings.cron.emptyTitle')}
							description={t('settings.cron.emptyDescription')}
						/>
					) : (
							tasks.map((task) => (
							<Item
								key={task.id}
								variant="outline"
								size="md"
								className="border-b border-border/60 px-5 py-4 last:border-b-0"
							>
								<ItemContent className="min-w-0 flex-1 flex-col items-start gap-1">
									<div className="flex w-full min-w-0 items-center gap-3">
										<button
											type="button"
											onClick={() =>
												navigate(`/settings/agent/tasks/${encodeURIComponent(task.id)}/detail`)
											}
											className="min-w-0 flex-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
										>
											<ItemTitle className="max-w-full truncate">{task.name}</ItemTitle>
										</button>
										<div className="ml-auto flex shrink-0 items-center gap-3">
											<span className="max-w-[45%] truncate text-right text-[11px] text-muted-foreground sm:max-w-none">
												{describeSchedule(task.cronExpression, t)}
											</span>
											<Switch
												checked={task.enabled}
												disabled={togglingTaskId === task.id}
												aria-label={`${task.enabled ? t('settings.cron.actions.disable') : t('settings.cron.actions.enable')} ${task.name}`}
												onCheckedChange={(enabled) =>
													void handleTaskEnabledChange(task.id, enabled)
												}
											></Switch>
										</div>
									</div>
									<p className="line-clamp-2 max-w-full text-[11px] leading-4 text-muted-foreground">
										{task.description ?? describeAction(task)}
									</p>
								</ItemContent>
							</Item>
						))
					)}
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default TasksPage;
