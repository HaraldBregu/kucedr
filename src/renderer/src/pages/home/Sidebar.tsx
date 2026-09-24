import { useEffect, useState, type ReactElement } from 'react';
import { CircleHelp, Code2, Layers, LogOut, MoreVertical, Plus, RadioTower, Server, Settings, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SPLIT_ITEM_ACTIVE_CLASS, SPLIT_ITEM_CLASS } from '@/components/app/base/page';
import { TextShimmer } from '@/components/prompt-kit/text-shimmer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
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
	const { sessionId, setSessionId, setSessionTitle } = useChatSession();
	const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [actionError, setActionError] = useState('');
	const [editingSessionId, setEditingSessionId] = useState<string>();
	const [editingTitle, setEditingTitle] = useState('');
	const [compactingSessionId, setCompactingSessionId] = useState<string>();
	const [pendingAction, setPendingAction] = useState<{ action: 'clear' | 'compact'; id: string; title: string }>();

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
	const confirmAction = (): void => {
		if (!pendingAction) return;
		const { action, id } = pendingAction;
		setPendingAction(undefined);
		setActionError('');
		if (action === 'clear') {
			void window.agent.clearMessages(id)
				.then(() => window.dispatchEvent(new CustomEvent('kucedr:session-history-cleared', { detail: id })))
				.catch(() => setActionError(t('settings.chatHistory.errors.clear')));
			return;
		}
		setCompactingSessionId(id);
		void window.agent.compactSession(id)
			.then((result) => {
				if (result.status === 'compacted')
					window.dispatchEvent(new CustomEvent('kucedr:session-compacted', { detail: id }));
			})
			.catch(() => setActionError(t('settings.chatHistory.errors.compact')))
			.finally(() => setCompactingSessionId(undefined));
	};

	useEffect(() => {
		const session = sessions.find((item) => item.id === currentSessionId);
		if (session) {
			setSessionTitle?.(session.title.trim() || t('settings.chatHistory.untitled'), session.id);
		} else if (currentSessionId === DEFAULT_CHAT_SESSION_ID) {
			setSessionTitle?.(undefined);
		}
	}, [currentSessionId, sessions, setSessionTitle, t]);

	const authenticatedUser = authState.status === 'signedIn' ? authState.user : undefined;
	const accountItem = {
		title: authenticatedUser ? t('settings.tabs.account') : t('settings.title'),
		description: authenticatedUser?.email ?? t('settings.sidebar.summary'),
		avatarPath: authenticatedUser?.avatarPath,
	};
	const accountInitial = accountItem.title.charAt(0).toUpperCase();
	const menuItems = [
		{ path: '/settings/account', label: t('settings.tabs.account'), icon: UserRound },
		{ path: '/settings/coding', label: t('settings.coding.title'), icon: Code2 },
		{ path: '/settings/providers', label: t('settings.sidebar.provider'), icon: Server },
		{ path: '/settings/channels', label: t('settings.tabs.channels'), icon: RadioTower },
		{ path: '/settings/apps', label: t('settings.tabs.apps'), icon: Layers },
		{ path: '/settings/general', label: t('settings.title'), icon: Settings },
	];

	return (
		<div data-slot="home-sidebar" className="flex h-full min-h-0 flex-col">
			<header className="shrink-0 border-b border-sidebar-border/50 p-2">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							type="button"
							className="px-2.5"
							aria-label={t('navigationBar.newChat', 'New chat')}
							onClick={() => {
								setSessionId(crypto.randomUUID());
								if (sessions.length === 0)
									setSessionTitle?.(t('navigationBar.newChat', 'New chat'));
							}}
						>
							<Plus className="size-4 shrink-0" />
							<span className="truncate">{t('navigationBar.newChat', 'New Chat')}</span>
							<kbd className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground opacity-0 group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100">
								{navigator.platform.startsWith('Mac') ? '⌘ + N' : 'Ctrl + N'}
							</kbd>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
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
								const isCompacting = compactingSessionId === session.id;
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
																if (isActive) setSessionTitle?.(nextTitle, session.id);
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
												onClick={() => {
													setSessionId(session.id);
													setSessionTitle?.(title, session.id);
												}}
												onContextMenu={(event) => {
													event.preventDefault();
													void window.win
												.showContextMenu([
													{ id: 'rename', label: t('common.rename', 'Rename') },
													{ id: 'clear', label: t('settings.chatHistory.clear') },
													{ id: 'compact', label: t('settings.chatHistory.compact') },
													{ id: 'open-location', label: t('navigationBar.openLocation', 'Open location') },
													{ id: 'delete', label: t('common.delete', 'Delete') },
												])
														.then((action) => {
															if (action === 'rename') {
																setEditingTitle(title);
														setEditingSessionId(session.id);
													}
													if (action === 'open-location') {
														void window.agent.openSessionFolder(session.id);
													}
													if (action === 'clear' || action === 'compact')
														setPendingAction({ action, id: session.id, title });
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
											{session.runStatus || isCompacting ? (
													<TextShimmer
														duration={2}
														className="truncate"
														style={
															{ '--foreground': 'var(--sidebar-foreground)' } as React.CSSProperties
														}
													>
												{isCompacting ? t('settings.chatHistory.compacting') : title}
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
			<Dialog open={!!pendingAction} onOpenChange={(open) => { if (!open) setPendingAction(undefined); }}>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>{t(`settings.chatHistory.${pendingAction?.action}`)}</DialogTitle>
						<DialogDescription>
							{pendingAction && t(`settings.chatHistory.confirm${pendingAction.action === 'clear' ? 'Clear' : 'Compact'}`, { title: pendingAction.title })}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose render={<Button variant="outline">{t('common.cancel')}</Button>} />
						<Button variant={pendingAction?.action === 'clear' ? 'destructive' : 'default'} onClick={confirmAction}>
							{t(`settings.chatHistory.${pendingAction?.action}`)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<SidebarFooter className="shrink-0 border-t border-sidebar-border/50">
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									aria-label={t('settings.sidebar.accountMenu', { name: accountItem.title })}
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar className="size-8 rounded-full grayscale">
										<AvatarImage src={accountItem.avatarPath} alt={accountItem.title} />
										<AvatarFallback className="rounded-full bg-accent text-accent-foreground">
											{accountInitial}
										</AvatarFallback>
									</Avatar>
									<span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{accountItem.title}</span>
										{accountItem.description ? (
											<span className="truncate text-[10px] text-muted-foreground">{accountItem.description}</span>
										) : null}
									</span>
									<MoreVertical className="ml-auto size-4" aria-hidden="true" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-64 rounded-lg"
								side="top"
								align="start"
							>
								<DropdownMenuLabel className="p-0 font-normal">
									<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
										<Avatar className="size-8 rounded-full">
											<AvatarImage src={accountItem.avatarPath} alt={accountItem.title} />
											<AvatarFallback className="rounded-full bg-accent text-accent-foreground">
												{accountInitial}
											</AvatarFallback>
										</Avatar>
										<div className="grid min-w-0 flex-1 text-left text-xs leading-tight">
											<span className="truncate font-medium">{accountItem.title}</span>
											{accountItem.description ? (
												<span className="truncate text-[10px] text-muted-foreground">{accountItem.description}</span>
											) : null}
										</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									{menuItems.map((item) => {
										const Icon = item.icon;
										return (
											<DropdownMenuItem key={item.path} asChild>
												<Link to={item.path}><Icon />{item.label}</Link>
											</DropdownMenuItem>
										);
									})}
								</DropdownMenuGroup>
								<DropdownMenuItem onSelect={() => void window.app.openExternalUrl('https://www.kucedr.com/help')}>
									<CircleHelp />
									{t('settings.sidebar.getHelp')}
								</DropdownMenuItem>
								{authenticatedUser ? (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onSelect={() => {
												void window.win.confirmSignOut().then((confirmed) => {
													if (confirmed) void window.auth.signOut();
												});
											}}
										>
											<LogOut />
											{t('settings.sidebar.signOut')}
										</DropdownMenuItem>
									</>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</div>
	);
}
