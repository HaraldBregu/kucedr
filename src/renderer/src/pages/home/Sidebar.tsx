import { useEffect, useState, type ReactElement } from 'react';
import { Plus, Settings2, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SPLIT_ITEM_ACTIVE_CLASS, SPLIT_ITEM_CLASS } from '@/components/app/base/page';
import { TextShimmer } from '@/components/prompt-kit/text-shimmer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_CHAT_SESSION_ID, useChatSession } from '@/contexts/chat-session';
import type { AgentSessionSummary } from '@/lib/compat';
import { cn } from '@/lib/utils';

interface HomeSidebarProps {
	readonly refreshKey: string;
}

export function HomeSidebar({ refreshKey }: HomeSidebarProps): ReactElement {
	const { t } = useTranslation();
	const { state: authState } = useAuth();
	const { sessionId, setSessionId } = useChatSession();
	const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [actionError, setActionError] = useState('');
	const [editingSessionId, setEditingSessionId] = useState<string>();
	const [editingTitle, setEditingTitle] = useState('');

	useEffect(() => {
		let active = true;
		const load = (): void => {
			void window.agent
				.listSessions()
				.then((nextSessions) => {
					if (!active) return;
					setError(false);
					setSessions(nextSessions);
					setLoading(false);
				})
				.catch(() => {
					if (!active) return;
					setError(true);
					setLoading(false);
				});
		};
		load();
		const interval = window.setInterval(load, 1500);

		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, [refreshKey, sessionId]);

	const retrySessions = (): void => {
		setLoading(true);
		setError(false);
		void window.agent
			.listSessions()
			.then((nextSessions) => {
				setSessions(nextSessions);
				setLoading(false);
			})
			.catch(() => {
				setError(true);
				setLoading(false);
			});
	};

	const currentSessionId = sessionId === DEFAULT_CHAT_SESSION_ID ? sessions[0]?.id : sessionId;
	const authenticatedUser = authState.status === 'signedIn' ? authState.user : undefined;
	const accountLabel = authenticatedUser
		? t('settings.accountAndSettings', 'Account and settings')
		: t('settings.title');

	return (
		<div data-slot="home-sidebar" className="flex h-full min-h-0 flex-col">
			<div
				aria-hidden="true"
				className="h-12 shrink-0 border-b border-sidebar-border/50"
				style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
			/>
			<header className="border-b border-sidebar-border/50 p-2">
				<button
					type="button"
					className={SPLIT_ITEM_CLASS}
					onClick={() => setSessionId(crypto.randomUUID())}
				>
					<Plus className="size-4" />
					<span>{t('titleBar.newChat', 'New chat')}</span>
				</button>
			</header>
			<section className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2 pt-3" aria-busy={loading}>
				<div className="px-2 pb-2 text-xs font-medium text-sidebar-foreground/70">
					{t('settings.chatHistory.title')}
				</div>
				{actionError ? (
					<p className="px-2 pb-2 text-xs text-destructive" role="alert">
						{actionError}
					</p>
				) : null}
				{loading ? (
					<div className="grid gap-2 px-2 py-1" aria-label={t('settings.chatHistory.loading')}>
						{[0, 1, 2, 3].map((row) => (
							<Skeleton key={row} className="h-8 w-full" />
						))}
					</div>
				) : error ? (
					<div className="grid gap-2 px-2 py-1 text-xs text-muted-foreground">
						<p>{t('settings.chatHistory.errors.load')}</p>
						<Button type="button" variant="ghost" size="sm" onClick={retrySessions}>
							{t('settings.chatHistory.refresh')}
						</Button>
					</div>
				) : sessions.length === 0 ? (
					<p className="px-2 py-1 text-xs text-muted-foreground">
						{t('settings.chatHistory.empty')}
					</p>
				) : (
					<nav aria-label={t('settings.chatHistory.title')}>
						<ul className="flex min-w-0 flex-col gap-1">
							{sessions.map((session) => {
								const title = session.title.trim() || t('settings.chatHistory.untitled');
								const isActive = session.id === currentSessionId;
								return (
									<li key={session.id} className="flex min-w-0 items-center">
										{editingSessionId === session.id ? (
											<Input
												autoFocus
												maxLength={120}
												value={editingTitle}
												onChange={(event) => setEditingTitle(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === 'Enter') event.currentTarget.blur();
													if (event.key === 'Escape') {
														event.currentTarget.value = title;
														event.currentTarget.blur();
													}
												}}
												onBlur={(event) => {
													const nextTitle = event.currentTarget.value.trim();
													setEditingSessionId(undefined);
													if (!nextTitle || nextTitle === title) return;
													void window.agent.renameSession(session.id, nextTitle).then(() => {
														setSessions((current) =>
															current.map((item) =>
																item.id === session.id ? { ...item, title: nextTitle } : item
															)
														);
													});
												}}
												aria-label={`Rename ${title}`}
												className="h-8 min-w-0 flex-1"
											/>
										) : (
											<button
												type="button"
												data-active={isActive ? '' : undefined}
												aria-current={isActive ? 'page' : undefined}
												className={cn(
													SPLIT_ITEM_CLASS,
													'min-w-0 flex-1',
													isActive && SPLIT_ITEM_ACTIVE_CLASS
												)}
												data-run-status={session.runStatus}
												onClick={() => setSessionId(session.id)}
												onContextMenu={(event) => {
													event.preventDefault();
													void window.win
														.showContextMenu([
															{ id: 'rename', label: t('common.rename', 'Rename') },
															{ id: 'delete', label: t('common.delete', 'Delete') },
														])
														.then((action) => {
															if (action === 'rename') {
																setEditingTitle(title);
																setEditingSessionId(session.id);
															}
															if (action === 'delete') {
																if (
																	!window.confirm(
																		t('settings.chatHistory.confirmDeleteSession', { title })
																	)
																)
																	return;
																setActionError('');
																void window.agent
																	.deleteSession(session.id)
																	.then(() => {
																		setSessions((current) =>
																			current.filter((item) => item.id !== session.id)
																		);
																		if (isActive) setSessionId(crypto.randomUUID());
																	})
																	.catch(() =>
																		setActionError(t('settings.chatHistory.errors.delete'))
																	);
															}
														});
												}}
											>
												{session.runStatus ? (
													<TextShimmer
														duration={2}
														className="truncate"
														style={
															{ '--foreground': 'var(--sidebar-foreground)' } as React.CSSProperties
														}
													>
														{title}
													</TextShimmer>
												) : (
													<span className="truncate">{title}</span>
												)}
											</button>
										)}
									</li>
								);
							})}
						</ul>
					</nav>
				)}
			</section>
			<footer className="shrink-0 border-t border-sidebar-border/50 p-2">
				<div className="flex min-w-0 items-center gap-1">
					<Link
						to="/settings/general"
						aria-label={accountLabel}
						title={accountLabel}
						className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
					>
						<span
							className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white"
							aria-hidden="true"
						>
							{authenticatedUser ? (
								<User className="size-3" strokeWidth={1.8} />
							) : (
								<Settings2 className="size-3" strokeWidth={1.8} />
							)}
						</span>
						<span className="min-w-0 truncate text-sm font-medium">{accountLabel}</span>
					</Link>
				</div>
			</footer>
		</div>
	);
}
