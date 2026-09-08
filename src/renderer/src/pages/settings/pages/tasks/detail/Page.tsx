import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsRow,
	SettingsSection,
} from '../../../components';

type Task = Awaited<ReturnType<typeof window.tasks.list>>[number];

const TaskDetailsPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { taskId } = useParams<{ taskId: string }>();
	const decodedTaskId = decodeURIComponent(taskId ?? '');
	const [task, setTask] = useState<Task | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [running, setRunning] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [toolsAllow, setToolsAllow] = useState('');

	useEffect(() => {
		let mounted = true;

		void window.tasks
			.list()
			.then((tasks) => {
				if (mounted) {
					const selected = tasks.find((item) => item.id === decodedTaskId) ?? null;
					setTask(selected);
					setToolsAllow(
						selected?.action.type === 'agent' ? (selected.action.toolsAllow ?? []).join(', ') : ''
					);
				}
			})
			.catch((caught: unknown) => {
				if (mounted) setError(caught instanceof Error ? caught.message : String(caught));
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});

		return () => {
			mounted = false;
		};
	}, [decodedTaskId]);

	if (loading) {
		return (
			<SettingsPageShell>
				<SettingsPageHeader title={t('settings.cron.detailsTitle')} />
				<SettingsLoadingRows rows={4} />
			</SettingsPageShell>
		);
	}

	if (!task) {
		return (
			<SettingsPageShell>
				<SettingsPageHeader title={t('settings.cron.detailsTitle')} />
				{error && <SettingsNotice variant="destructive" icon={AlertTriangle}>{error}</SettingsNotice>}
				<Card size="sm" className="gap-0! p-0!">
					<SettingsEmptyState
						icon={ListChecks}
						title={t('settings.cron.notFoundTitle')}
						description={t('settings.cron.notFoundDescription')}
						className="min-h-28"
					/>
				</Card>
			</SettingsPageShell>
		);
	}

	const actionType = task.action.type === 'agent'
		? t('settings.cron.detail.agent')
		: t('settings.cron.detail.debug');
	const runNow = async (): Promise<void> => {
		setRunning(true);
		setError(null);
		try {
			await window.tasks.runNow(task.id);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setRunning(false);
		}
	};
	const deleteTask = async (): Promise<void> => {
		if (!window.confirm(t('settings.cron.actions.confirmRemove', { id: task.id }))) return;
		setDeleting(true);
		setError(null);
		try {
			await window.tasks.delete(task.id);
			navigate('/settings/agent/tasks');
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
			setDeleting(false);
		}
	};
	const saveCapabilities = async (): Promise<void> => {
		if (task.action.type !== 'agent') return;
		setSaving(true);
		setError(null);
		try {
			setTask(
				await window.tasks.configureCapabilities(
					task.id,
					task.enabled,
					toolsAllow.split(',').map((name) => name.trim()).filter(Boolean)
				)
			);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSaving(false);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={task.name}
				description={task.description ?? t('settings.cron.detail.noDescription')}
				action={
					<Badge variant={task.enabled ? 'default' : 'secondary'}>
						{task.enabled ? t('settings.cron.enabled') : t('settings.cron.disabled')}
					</Badge>
				}
			/>

			{error && <SettingsNotice variant="destructive" icon={AlertTriangle}>{error}</SettingsNotice>}

			<SettingsSection title={t('settings.cron.detailsTitle')}>
				<Card size="sm" className="gap-0! p-0!">
					<Item variant="outline" size="md" className="border-b border-border/60">
						<ItemContent><ItemTitle>{t('settings.cron.detail.id')}</ItemTitle></ItemContent>
						<ItemActions className="ml-auto justify-end"><code className="max-w-[55vw] truncate text-[11px]">{task.id}</code></ItemActions>
					</Item>
					<Item variant="outline" size="md" className="border-b border-border/60">
						<ItemContent><ItemTitle>{t('settings.cron.detail.schedule')}</ItemTitle></ItemContent>
						<ItemActions className="ml-auto justify-end"><code className="max-w-[55vw] truncate text-[11px]">{task.cronExpression ?? t('settings.cron.detail.notScheduled')}</code></ItemActions>
					</Item>
					<Item variant="outline" size="md" className="border-b border-border/60">
						<ItemContent><ItemTitle>{t('settings.cron.detail.actionType')}</ItemTitle></ItemContent>
						<ItemActions className="ml-auto justify-end"><span className="text-xs">{actionType}</span></ItemActions>
					</Item>
					{task.action.type === 'agent' && <>
						<Item variant="outline" size="md" className="border-b border-border/60">
							<ItemContent><ItemTitle>{t('settings.cron.detail.effort')}</ItemTitle></ItemContent>
							<ItemActions className="ml-auto justify-end"><span className="text-xs">{task.action.effort}</span></ItemActions>
						</Item>
					</>}
					<Item variant="outline" size="md" className="border-b border-border/60">
						<ItemContent><ItemTitle>{t('settings.cron.detail.createdAt')}</ItemTitle></ItemContent>
						<ItemActions className="ml-auto justify-end"><time className="text-xs" dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString()}</time></ItemActions>
					</Item>
					<Item variant="outline" size="md">
						<ItemContent><ItemTitle>{t('settings.cron.detail.updatedAt')}</ItemTitle></ItemContent>
						<ItemActions className="ml-auto justify-end"><time className="text-xs" dateTime={task.updatedAt}>{new Date(task.updatedAt).toLocaleString()}</time></ItemActions>
					</Item>
				</Card>
			</SettingsSection>

			{task.action.type === 'agent' && (
				<SettingsSection
					title={t('settings.cron.detail.promptInput')}
					description={t('settings.cron.detail.promptInputDescription')}
				>
					<Card size="sm" className="p-3!">
						<pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-foreground">
							{task.action.prompt}
						</pre>
					</Card>
				</SettingsSection>
			)}

			{task.action.type === 'agent' && (
				<SettingsSection
					title={t('settings.cron.detail.capabilities')}
					description={t('settings.cron.detail.capabilitiesDescription')}
				>
					<Card size="sm" className="grid gap-3 p-3!">
						<SettingsRow
							title={t('settings.cron.detail.enabled')}
							description={t('settings.cron.detail.enabledDescription')}
							actions={
								<Switch
									checked={task.enabled}
									disabled={saving}
									onCheckedChange={(enabled) => setTask({ ...task, enabled })}
								/>
							}
						/>
						<Input
							value={toolsAllow}
							disabled={saving}
							placeholder={t('settings.cron.detail.toolsPlaceholder')}
							onChange={(event) => setToolsAllow(event.target.value)}
						/>
						<div className="flex justify-end">
							<Button size="sm" disabled={saving} onClick={() => void saveCapabilities()}>
								{t('settings.cron.detail.saveCapabilities')}
							</Button>
						</div>
					</Card>
				</SettingsSection>
			)}

			<div className="flex justify-end gap-2">
				<Button size="sm" disabled={running || deleting} onClick={() => void runNow()}>
					{running ? t('settings.cron.actions.running') : t('settings.cron.actions.run')}
				</Button>
				<Button variant="destructive" size="sm" disabled={running || deleting} onClick={() => void deleteTask()}>
					{deleting ? t('settings.cron.actions.removing') : t('settings.cron.actions.remove')}
				</Button>
			</div>
		</SettingsPageShell>
	);
};

export default TaskDetailsPage;
