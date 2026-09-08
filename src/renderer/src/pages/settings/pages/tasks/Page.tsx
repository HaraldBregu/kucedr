import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
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

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.taskScheduler')}
				description={t('settings.cron.description')}
			/>

			<SettingsSection
				title={t('settings.cron.runtime.title')}
				description={t('settings.cron.runtime.description')}
			>
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
					description={t('settings.modelServices.modelDescription')}
					showInlineError
					onChange={(nextProviderId, nextModelId) =>
						void handleChange(nextProviderId, nextModelId)
					}
				/>
			</SettingsSection>

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
								as="button"
								type="button"
								onClick={() => navigate(`/settings/agent/tasks/${encodeURIComponent(task.id)}/detail`)}
								variant="outline"
								size="md"
								className="cursor-pointer border-b border-border/60 text-left hover:bg-muted/50 last:border-b-0 px-5 py-4"
							>
								<ItemContent className="min-w-0 flex-1 flex-col items-start gap-1">
									<ItemTitle className="max-w-full truncate">{task.name}</ItemTitle>
									<p className="line-clamp-2 max-w-full text-[11px] leading-4 text-muted-foreground">
										{describeAction(task)}
									</p>
									{task.cronExpression && (
										<code className="text-[11px] text-muted-foreground">{task.cronExpression}</code>
									)}
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<Badge
										variant={task.enabled ? 'default' : 'secondary'}
										className="text-[10px] leading-none"
									>
										{task.enabled ? t('settings.cron.enabled') : t('settings.cron.disabled')}
									</Badge>
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
