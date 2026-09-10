import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, FolderOpen, History, ListChecks, LoaderCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { Switch } from '@/components/ui/switch';
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
	const [running, setRunning] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deletingHistory, setDeletingHistory] = useState(false);
	const [toggling, setToggling] = useState(false);
	const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;

		void Promise.all([window.tasks.list(), window.tasks.history(decodedTaskId)])
			.then(([tasks, taskHistory]) => {
				if (mounted) {
					const selected = tasks.find((item) => item.id === decodedTaskId) ?? null;
					setTask(selected);
					setHistory(taskHistory);
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
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setToggling(false);
		}
	};
	const openSessionFolder = async (sessionId: string): Promise<void> => {
		setOpeningSessionId(sessionId);
		setError(null);
		try {
			await window.agent.openSessionFolder(sessionId);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setOpeningSessionId(null);
		}
	};
	const deleteHistory = async (): Promise<void> => {
		if (!window.confirm(t('settings.cron.history.confirmDelete'))) return;
		setDeletingHistory(true);
		setError(null);
		try {
			await Promise.all(history.map((session) => window.agent.deleteSession(session.id)));
			setHistory([]);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setDeletingHistory(false);
		}
	};
	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={task.name}
				description={task.description ?? t('settings.cron.detail.noDescription')}
				action={
					<Switch
						checked={task.enabled}
						disabled={toggling}
						aria-label={
							task.enabled ? t('settings.cron.actions.disable') : t('settings.cron.actions.enable')
						}
						onCheckedChange={() => void toggleEnabled()}
					/>
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

			<SettingsSection
				title={t('settings.cron.detail.promptInput')}
			>
				<Card size="sm" className="p-4!">
					<pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-foreground">
						{task.prompt}
					</pre>
				</Card>
			</SettingsSection>

			<SettingsSection
				title={t('settings.cron.history.title')}
				action={
					<Button
						type="button"
						variant="destructive"
						size="icon-sm"
						disabled={history.length === 0 || deletingHistory || deleting || toggling}
						aria-label={t('settings.cron.history.delete')}
						title={t('settings.cron.history.delete')}
						onClick={() => void deleteHistory()}
					>
						{deletingHistory ? (
							<LoaderCircle className="size-3.5 animate-spin" />
						) : (
							<Trash2 className="size-3.5" />
						)}
					</Button>
				}
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
						history.map((session, index) => (
							<Item
								key={session.id}
								variant="outline"
								size="md"
								className={`px-5 py-4 ${index < history.length - 1 ? 'border-b border-border/60' : ''}`}
							>
								<ItemContent className="min-w-0">
									<ItemTitle className="text-sm">{session.title.trim() || session.id}</ItemTitle>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<time
										className="text-xs text-muted-foreground"
										dateTime={new Date(session.createdAtMs).toISOString()}
									>
										{new Date(session.createdAtMs).toLocaleString()}
									</time>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										disabled={openingSessionId === session.id}
										aria-label={t('settings.cron.history.openFolder')}
										title={t('settings.cron.history.openFolder')}
										onClick={() => void openSessionFolder(session.id)}
									>
										<FolderOpen className="size-3.5" />
									</Button>
								</ItemActions>
							</Item>
						))
					)}
				</Card>
			</SettingsSection>

			<div className="flex justify-end gap-2">
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
