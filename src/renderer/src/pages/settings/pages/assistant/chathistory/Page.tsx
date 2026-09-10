import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, FolderOpen, LoaderCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AgentSessionSummary } from '@/lib/compat';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
} from '../../../components';
import { firstErrorMessage } from '../../../components/model-configuration-state';

function formatSessionDate(createdAtMs: number): string {
	return new Date(createdAtMs).toLocaleString();
}

const ChatHistoryPage: React.FC = () => {
	const { t } = useTranslation();
	const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
	const [deletingAll, setDeletingAll] = useState(false);
	const [actionsOpen, setActionsOpen] = useState(false);

	const loadSessions = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError(null);
		try {
			const nextSessions = await window.agent.listSessions();
			setSessions(nextSessions);
		} catch (loadError) {
			setError(firstErrorMessage(loadError, t('settings.chatHistory.errors.load')));
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void loadSessions();
	}, [loadSessions]);

	const handleDelete = async (session: AgentSessionSummary): Promise<void> => {
		const title = session.title.trim() || t('settings.chatHistory.untitled');
		if (!window.confirm(t('settings.chatHistory.confirmDeleteSession', { title }))) return;
		setDeletingSessionId(session.id);
		setError(null);
		try {
			await window.agent.deleteSession(session.id);
			setSessions((current) => current.filter((entry) => entry.id !== session.id));
		} catch (deleteError) {
			setError(firstErrorMessage(deleteError, t('settings.chatHistory.errors.delete')));
		} finally {
			setDeletingSessionId(null);
		}
	};

	const handleDeleteAll = async (): Promise<void> => {
		if (!window.confirm(t('settings.chatHistory.confirmDelete'))) return;
		setActionsOpen(false);
		setDeletingAll(true);
		setError(null);
		try {
			await Promise.all(sessions.map((session) => window.agent.deleteSession(session.id)));
			setSessions([]);
		} catch (deleteError) {
			setError(firstErrorMessage(deleteError, t('settings.chatHistory.errors.delete')));
		} finally {
			setDeletingAll(false);
		}
	};

	const handleOpenFolder = async (): Promise<void> => {
		setActionsOpen(false);
		setError(null);
		try {
			await window.agent.openSessionsFolder();
		} catch (openFolderError) {
			setError(firstErrorMessage(openFolderError, t('settings.chatHistory.errors.openFolder')));
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.chatHistory.title')}
				description={t('settings.chatHistory.description')}
				action={
					<Popover open={actionsOpen} onOpenChange={setActionsOpen}>
						<PopoverTrigger asChild>
							<Button variant="outline" size="icon-sm" aria-label={t('common.moreOptions')}>
								<MoreHorizontal className="size-3.5" />
							</Button>
						</PopoverTrigger>
						<PopoverContent align="end" collisionPadding={12} className="w-56 p-1">
							<div role="menu" aria-label={t('settings.chatHistory.actions')}>
								<button
									type="button"
									role="menuitem"
									disabled={deletingAll || deletingSessionId !== null}
									onClick={() => void handleOpenFolder()}
									className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50"
								>
									<FolderOpen className="size-3.5" />
									{t('settings.chatHistory.openFolder')}
								</button>
								<button
									type="button"
									role="menuitem"
									disabled={
										loading || sessions.length === 0 || deletingAll || deletingSessionId !== null
									}
									onClick={() => void handleDeleteAll()}
									className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive outline-none hover:bg-destructive/10 focus-visible:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
								>
									{deletingAll ? (
										<LoaderCircle className="size-3.5 animate-spin" />
									) : (
										<Trash2 className="size-3.5" />
									)}
									{deletingAll
										? t('settings.chatHistory.deleting')
										: t('settings.chatHistory.delete')}
								</button>
							</div>
						</PopoverContent>
					</Popover>
				}
			/>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}

			<SettingsPanel>
				{loading ? (
					<SettingsLoadingRows rows={4} />
				) : sessions.length === 0 ? (
					<SettingsEmptyState
						title={t('settings.chatHistory.empty')}
						description={t('settings.chatHistory.emptyDescription')}
					/>
				) : (
					sessions.map((session) => {
						const title = session.title.trim() || t('settings.chatHistory.untitled');
						const isDeleting = deletingSessionId === session.id;
						return (
							<SettingsRow
								key={session.id}
								title={title}
								description={formatSessionDate(session.createdAtMs)}
								className="grid-cols-[minmax(0,1fr)_auto]"
								actionClassName="w-auto justify-end"
								actions={
									<Button
										type="button"
										variant="destructive"
										size="icon"
										className="size-8"
										disabled={deletingAll || deletingSessionId !== null}
										aria-label={t('settings.chatHistory.deleteSession', { title })}
										onClick={() => void handleDelete(session)}
									>
										{isDeleting ? (
											<LoaderCircle className="size-3 animate-spin" />
										) : (
											<Trash2 className="size-3" />
										)}
									</Button>
								}
							/>
						);
					})
				)}
			</SettingsPanel>
		</SettingsPageShell>
	);
};

export default ChatHistoryPage;
