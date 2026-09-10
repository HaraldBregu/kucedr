import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BrainCircuit, ListChecks } from 'lucide-react';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { Switch } from '@/components/ui/switch';
import { providerIdsFor, providerModels, providers } from '@/lib/providers';
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

	const modelGroups = taskModelGroups();

	useEffect(() => {
		let mounted = true;
		void Promise.all([window.tasks.list(), window.tasks.getRuntime()])
			.then(([list, runtime]) => {
				if (!mounted) return;
				setTasks(list);
				const groups = taskModelGroups();
				const group = groups.find((item) => item.provider.id === runtime?.providerId) ?? groups[0];
				const model = group?.models.find((item) => item.id === runtime?.modelId) ?? group?.models[0];
				setProviderId(group?.provider.id ?? '');
				setModelId(model?.id ?? '');
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
		setSaving(true);
		setSaved(false);
		setRuntimeError(null);
		try {
			await window.tasks.setRuntime(nextProviderId, nextModelId);
			setSaved(true);
		} catch (err) {
			setRuntimeError(
				err instanceof Error ? err.message : t('settings.cron.runtime.errors.saveFailed')
			);
		} finally {
			setSaving(false);
		}
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
					onChange={(nextProviderId, nextModelId) =>
						void handleChange(nextProviderId, nextModelId)
					}
				/>
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
									<button
										type="button"
										onClick={() => navigate(`/settings/agent/tasks/${encodeURIComponent(task.id)}/detail`)}
										className="w-full min-w-0 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
									>
										<ItemTitle className="max-w-full truncate">{task.name}</ItemTitle>
										<p className="line-clamp-2 max-w-full text-[11px] leading-4 text-muted-foreground">
											{describeAction(task)}
										</p>
										{task.cronExpression && (
											<code className="text-[11px] text-muted-foreground">{task.cronExpression}</code>
										)}
									</button>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<Switch
										checked={task.enabled}
										disabled={togglingTaskId === task.id}
										aria-label={`${task.enabled ? t('settings.cron.actions.disable') : t('settings.cron.actions.enable')} ${task.name}`}
										onCheckedChange={(enabled) =>
											void handleTaskEnabledChange(task.id, enabled)
										}
									>
									</Switch>
								</ItemActions>
							</Item>
						))
					)}
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default TasksPage;
