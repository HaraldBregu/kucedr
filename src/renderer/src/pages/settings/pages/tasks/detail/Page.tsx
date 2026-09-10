import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, History, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsSection,
} from '../../../components';

type Task = Awaited<ReturnType<typeof window.tasks.list>>[number];
type TaskHistory = Awaited<ReturnType<typeof window.tasks.history>>;

const TaskDetailsPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { taskId } = useParams<{ taskId: string }>();
	const decodedTaskId = decodeURIComponent(taskId ?? '');
	const [task, setTask] = useState<Task | null>(null);
	const [history, setHistory] = useState<TaskHistory>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [running, setRunning] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [toggling, setToggling] = useState(false);
	const [toolsAllow, setToolsAllow] = useState('');

	useEffect(() => {
		let mounted = true;

		void Promise.all([window.tasks.list(), window.tasks.history(decodedTaskId)])
			.then(([tasks, taskHistory]) => {
				if (mounted) {
					const selected = tasks.find((item) => item.id === decodedTaskId) ?? null;
					setTask(selected);
					setHistory(taskHistory);
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
				{error && (
					<SettingsNotice variant="destructive" icon={AlertTriangle}>
						{error}
					</SettingsNotice>
				)}
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

	const actionType =
		task.action.type === 'agent'
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
	const toggleEnabled = async (): Promise<void> => {
		setToggling(true);
		setError(null);
		try {
			setTask(await window.tasks.setEnabled(task.id, !task.enabled));
			setHistory(await window.tasks.history(task.id));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setToggling(false);
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
					toolsAllow
						.split(',')
						.map((name) => name.trim())
						.filter(Boolean)
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

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}

			<SettingsSection title={t('settings.cron.detailsTitle')}>
				<Card size="sm" className="gap-0! p-0!">
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemContent>
							<ItemTitle>{t('settings.cron.detail.id')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto justify-end">
							<code className="max-w-[55vw] truncate text-[11px]">{task.id}</code>
						</ItemActions>
					</Item>
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemContent>
							<ItemTitle>{t('settings.cron.detail.schedule')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto justify-end">
							<code className="max-w-[55vw] truncate text-[11px]">
								{task.cronExpression ?? t('settings.cron.detail.notScheduled')}
							</code>
						</ItemActions>
					</Item>
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemContent>
							<ItemTitle>{t('settings.cron.detail.actionType')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto justify-end">
							<span className="text-xs">{actionType}</span>
						</ItemActions>
					</Item>
					{task.action.type === 'agent' && (
						<>
							<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
								<ItemContent>
									<ItemTitle>{t('settings.cron.detail.effort')}</ItemTitle>
								</ItemContent>
								<ItemActions className="ml-auto justify-end">
									<span className="text-xs">{task.action.effort}</span>
								</ItemActions>
							</Item>
						</>
					)}
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemContent>
							<ItemTitle>{t('settings.cron.detail.createdAt')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto justify-end">
							<time className="text-xs" dateTime={task.createdAt}>
								{new Date(task.createdAt).toLocaleString()}
							</time>
						</ItemActions>
					</Item>
					<Item variant="outline" size="md" className="px-5 py-4">
						<ItemContent>
							<ItemTitle>{t('settings.cron.detail.updatedAt')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto justify-end">
							<time className="text-xs" dateTime={task.updatedAt}>
								{new Date(task.updatedAt).toLocaleString()}
							</time>
						</ItemActions>
					</Item>
				</Card>
			</SettingsSection>

			{task.action.type === 'agent' && (
				<SettingsSection
					title={t('settings.cron.detail.promptInput')}
					description={t('settings.cron.detail.promptInputDescription')}
				>
					<Card size="sm" className="p-4!">
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
					<Card size="sm" className="grid gap-3 p-4!">
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

			<SettingsSection
				title={t('settings.cron.history.title')}
				description={t('settings.cron.history.description')}
			>
				<Card size="sm" className="gap-0! p-0!">
					{history.length === 0 ? (
						<SettingsEmptyState
							icon={History}
							title={t('settings.cron.history.emptyTitle')}
							description={t('settings.cron.history.emptyDescription')}
							className="min-h-28"
						/>
					) : (
						history.map((event, index) => (
							<Item
								key={event.eventId}
								variant="outline"
								size="md"
								className={`px-5 py-4 ${index < history.length - 1 ? 'border-b border-border/60' : ''}`}
							>
								<ItemContent className="min-w-0">
									<ItemTitle className="text-sm">{event.message}</ItemTitle>
									<p className="text-[11px] text-muted-foreground">
										{event.type.replace('schedule.', '')}
									</p>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<time className="text-xs text-muted-foreground" dateTime={event.timestamp}>
										{new Date(event.timestamp).toLocaleString()}
									</time>
								</ItemActions>
							</Item>
						))
					)}
				</Card>
			</SettingsSection>

			<div className="flex justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={running || deleting || toggling}
					onClick={() => void toggleEnabled()}
				>
					{toggling
						? t('settings.cron.actions.updating')
						: task.enabled
							? t('settings.cron.actions.disable')
							: t('settings.cron.actions.enable')}
				</Button>
				<Button size="sm" disabled={running || deleting || toggling} onClick={() => void runNow()}>
					{running ? t('settings.cron.actions.running') : t('settings.cron.actions.run')}
				</Button>
				<Button
					variant="destructive"
					size="sm"
					disabled={running || deleting || toggling}
					onClick={() => void deleteTask()}
				>
					{deleting ? t('settings.cron.actions.removing') : t('settings.cron.actions.remove')}
				</Button>
			</div>
		</SettingsPageShell>
	);
};

export default TaskDetailsPage;
