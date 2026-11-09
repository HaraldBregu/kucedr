import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Folders, LayoutPanelLeft, MoreVertical, Pin, PinOff, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SPLIT_ITEM_ACTIVE_CLASS, SPLIT_ITEM_CLASS } from '@/components/app/base/page';
import { AppSidebarFooter } from '@/components/app/SidebarFooter';
import { TextShimmer } from '@/components/prompt-kit/text-shimmer';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_CHAT_SESSION_ID, useChatSession } from '@/contexts/chat-session';
import type { AgentSessionSummary } from '@/lib/compat';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/sounds/play';
import type { OpenExtension } from './components/ExtensionPage';
import { stored } from './stored';

const SESSION_MIME = 'application/x-chat-session';

interface ChatCategory {
	readonly id: string;
	readonly name: string;
}

interface HomeSidebarProps {
	readonly refreshKey: string;
	readonly openExtension: OpenExtension | null;
}

export function HomeSidebar({ refreshKey, openExtension }: HomeSidebarProps): ReactElement {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { sessionId, setSessionId, setSessionTitle } = useChatSession();
	const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [actionError, setActionError] = useState('');
	const [editingSessionId, setEditingSessionId] = useState<string>();
	const [editingTitle, setEditingTitle] = useState('');
	const [compactingSessionId, setCompactingSessionId] = useState<string>();
	const [pendingAction, setPendingAction] = useState<{ action: 'clear' | 'compact'; id: string; title: string }>();
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
	const [selectionAnchor, setSelectionAnchor] = useState<string>();
	const [categories, setCategories] = useState<ChatCategory[]>(() => stored('chat-categories', []));
	const [assignments, setAssignments] = useState<Record<string, string>>(() => stored('chat-category-assignments', {}));
	const [collapsed, setCollapsed] = useState<string[]>(() => stored('chat-collapsed-groups', []));
	const [editingCategoryId, setEditingCategoryId] = useState<string>();
	const [dropTarget, setDropTarget] = useState<string>();

	useEffect(() => localStorage.setItem('chat-categories', JSON.stringify(categories)), [categories]);
	useEffect(() => localStorage.setItem('chat-category-assignments', JSON.stringify(assignments)), [assignments]);
	useEffect(() => localStorage.setItem('chat-collapsed-groups', JSON.stringify(collapsed)), [collapsed]);
	const syncedCategories = useRef<Record<string, string | null>>({});
	useEffect(() => {
		for (const session of sessions) {
			const name = categories.find((category) => category.id === assignments[session.id])?.name ?? null;
			if (syncedCategories.current[session.id] === name) continue;
			syncedCategories.current[session.id] = name;
			void window.agent.categorizeSession(session.id, name).catch(() => delete syncedCategories.current[session.id]);
		}
	}, [sessions, categories, assignments]);

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

	const activeSessions = sessions.filter((session) => !session.archived);
	const currentSessionId = sessionId === DEFAULT_CHAT_SESSION_ID ? activeSessions[0]?.id : sessionId;
	const clearSelection = (): void => {
		setSelectedIds(new Set());
		setSelectionAnchor(undefined);
	};
	const selectionTargets = (session: AgentSessionSummary): AgentSessionSummary[] =>
		selectedIds.has(session.id) && selectedIds.size > 1
			? sessions.filter((item) => selectedIds.has(item.id))
			: [session];
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

	const deleteSessions = (targets: AgentSessionSummary[]): void => {
		const message =
			targets.length === 1
				? t('settings.chatHistory.confirmDeleteSession', {
						title: targets[0].title.trim() || t('settings.chatHistory.untitled'),
					})
				: t('settings.chatHistory.confirmDeleteSessions', { total: targets.length });
		if (!window.confirm(message)) return;
		const ids = new Set(targets.map((item) => item.id));
		setActionError('');
		clearSelection();
		void Promise.all(targets.map((item) => window.agent.deleteSession(item.id)))
			.then(() => {
				setSessions((current) => current.filter((item) => !ids.has(item.id)));
				if (currentSessionId && ids.has(currentSessionId)) setSessionId(crypto.randomUUID());
			})
			.catch(() => setActionError(t('settings.chatHistory.errors.delete')));
	};

	const archiveSessions = (targets: AgentSessionSummary[]): void => {
		const ids = new Set(targets.map((item) => item.id));
		setActionError('');
		clearSelection();
		void Promise.all(targets.map((item) => window.agent.archiveSession(item.id, true)))
			.then(() => {
				setSessions((current) => current.filter((item) => !ids.has(item.id)));
				if (currentSessionId && ids.has(currentSessionId)) setSessionId(crypto.randomUUID());
			})
			.catch(() => setActionError(t('settings.chatHistory.errors.archive')));
	};

	useEffect(() => {
		const session = sessions.find((item) => item.id === currentSessionId);
		if (session) {
			setSessionTitle?.(session.title.trim() || t('settings.chatHistory.untitled'), session.id);
		} else if (currentSessionId === DEFAULT_CHAT_SESSION_ID) {
			setSessionTitle?.(undefined);
		}
	}, [currentSessionId, sessions, setSessionTitle, t]);

	const togglePin = (targets: AgentSessionSummary[]): void => {
		const pinned = !targets.every((item) => item.pinned);
		const ids = new Set(targets.map((item) => item.id));
		setActionError('');
		clearSelection();
		void Promise.all(targets.map((item) => window.agent.pinSession(item.id, pinned)))
			.then(() =>
				setSessions((current) =>
					current.map((item) => (ids.has(item.id) ? { ...item, pinned } : item))
				)
			)
			.catch(() => setActionError(t('settings.chatHistory.errors.pin')));
	};

	const moveToCategory = (ids: string[], categoryId: string | undefined): void => {
		clearSelection();
		setAssignments((current) => {
			const next = { ...current };
			for (const id of ids) {
				if (categoryId) next[id] = categoryId;
				else delete next[id];
			}
			return next;
		});
	};

	const createCategory = (ids: string[]): void => {
		const id = crypto.randomUUID();
		setCategories((current) => [...current, { id, name: t('settings.chatHistory.newCategory', 'New category') }]);
		moveToCategory(ids, id);
		setEditingCategoryId(id);
	};

	const deleteCategory = (id: string): void => {
		setCategories((current) => current.filter((category) => category.id !== id));
		setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => value !== id)));
		setCollapsed((current) => current.filter((key) => key !== id));
	};

	const pinnedSessions = activeSessions.filter((session) => session.pinned);
	const categoryIds = new Set(categories.map((category) => category.id));
	const recentSessions = activeSessions.filter((session) => !session.pinned && !categoryIds.has(assignments[session.id]));

	const renderGroup = (
		key: string,
		label: string,
		content: ReactNode,
		options: { className?: string; drop?: string | null } = {}
	): ReactElement => {
		const category = categories.find((item) => item.id === key);
		const droppable = options.drop !== undefined;
		return (
			<Collapsible
				key={key}
				open={!collapsed.includes(key)}
				onOpenChange={(open) => setCollapsed((current) => (open ? current.filter((item) => item !== key) : [...current, key]))}
				className={cn('group/collapsible', options.className)}
			>
				<SidebarGroup
					className={cn('rounded-md', dropTarget === key && 'bg-sidebar-accent/60 ring-1 ring-inset ring-sidebar-ring')}
					onDragOver={(event) => {
						if (!droppable || !event.dataTransfer.types.includes(SESSION_MIME)) return;
						event.preventDefault();
						event.dataTransfer.dropEffect = 'move';
						setDropTarget(key);
					}}
					onDragLeave={(event) => {
						if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(undefined);
					}}
					onDrop={(event) => {
						const ids = event.dataTransfer.getData(SESSION_MIME);
						setDropTarget(undefined);
						if (!droppable || !ids) return;
						event.preventDefault();
						const dropped = ids.split('\n');
						const pinned = sessions.filter((session) => session.pinned && dropped.includes(session.id));
						if (pinned.length > 0) togglePin(pinned);
						moveToCategory(dropped, options.drop ?? undefined);
					}}
				>
					{category && editingCategoryId === category.id ? (
						<Input
							autoFocus
							maxLength={60}
							defaultValue={category.name}
							onKeyDown={(event) => {
								if (event.key === 'Enter') event.currentTarget.blur();
								if (event.key === 'Escape') {
									event.currentTarget.value = category.name;
									event.currentTarget.blur();
								}
							}}
							onBlur={(event) => {
								const name = event.currentTarget.value.trim();
								setEditingCategoryId(undefined);
								if (name) setCategories((current) => current.map((item) => (item.id === category.id ? { ...item, name } : item)));
							}}
							aria-label={t('common.rename', 'Rename')}
							className="h-8"
						/>
					) : (
						<CollapsibleTrigger
							nativeButton={false}
							render={<SidebarGroupLabel />}
							onDoubleClick={category ? () => setEditingCategoryId(category.id) : undefined}
							onContextMenu={category ? (event: React.MouseEvent) => {
								event.preventDefault();
								void window.win
									.showContextMenu([
										{ id: 'rename', label: t('common.rename', 'Rename') },
										{ id: 'delete', label: t('common.delete', 'Delete') },
									])
									.then((action) => {
										if (action === 'rename') setEditingCategoryId(category.id);
										if (action === 'delete') deleteCategory(category.id);
									});
							} : undefined}
						>
							<span className="truncate">{label}</span>
							<ChevronRight className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
						</CollapsibleTrigger>
					)}
					<CollapsibleContent>
						<SidebarGroupContent>{content}</SidebarGroupContent>
					</CollapsibleContent>
				</SidebarGroup>
			</Collapsible>
		);
	};

	const renderSession = (session: AgentSessionSummary, index: number, group: AgentSessionSummary[]): ReactElement => {
		const title = session.title.trim() || t('settings.chatHistory.untitled');
		const isActive = session.id === currentSessionId;
		const isCompacting = compactingSessionId === session.id;
		const isSelected = selectedIds.has(session.id);
		const select = (event: React.MouseEvent): boolean => {
			if (event.metaKey || event.ctrlKey) {
				const next = new Set(selectedIds.size || !currentSessionId ? selectedIds : [currentSessionId]);
				if (!next.delete(session.id)) next.add(session.id);
				setSelectedIds(next);
				setSelectionAnchor(session.id);
				return true;
			}
			if (event.shiftKey) {
				const anchor = group.findIndex((item) => item.id === (selectionAnchor ?? currentSessionId));
				const range = group.slice(Math.min(anchor < 0 ? index : anchor, index), Math.max(anchor, index) + 1);
				setSelectedIds(new Set(range.map((item) => item.id)));
				return true;
			}
			clearSelection();
			return false;
		};
		const openMenu = (): void => {
			const targets = selectionTargets(session);
			if (!isSelected) clearSelection();
			const isBulk = targets.length > 1;
			const allPinned = targets.every((item) => item.pinned);
			void window.win
				.showContextMenu([
					...(isBulk
						? [
								{
									id: 'selection',
									label: t('settings.chatHistory.selectedCount', { total: targets.length }),
									enabled: false,
								},
							]
						: [
								{ id: 'rename', label: t('common.rename', 'Rename') },
								{ id: 'clear', label: t('settings.chatHistory.clear') },
								{ id: 'compact', label: t('settings.chatHistory.compact') },
								{ id: 'open-location', label: t('navigationBar.openLocation', 'Open location') },
							]),
					{ id: 'pin', label: allPinned ? t('common.unpin', 'Unpin') : t('common.pin', 'Pin') },
					{ type: 'separator' as const },
					...categories
						.filter((category) => !targets.every((item) => assignments[item.id] === category.id))
						.map((category) => ({
							id: `move:${category.id}`,
							label: t('settings.chatHistory.moveTo', { name: category.name, defaultValue: 'Move to {{name}}' }),
						})),
					...(targets.some((item) => categoryIds.has(assignments[item.id]))
						? [{ id: 'uncategorize', label: t('settings.chatHistory.removeFromCategory', 'Remove from category') }]
						: []),
					{ id: 'new-category', label: t('settings.chatHistory.moveToNewCategory', 'Move to new category') },
					{ type: 'separator' as const },
					{ id: 'archive', label: t('settings.chatHistory.archive') },
					{ id: 'delete', label: t('common.delete', 'Delete') },
				])
				.then((action) => {
					const ids = targets.map((item) => item.id);
					if (action?.startsWith('move:')) moveToCategory(ids, action.slice(5));
					if (action === 'uncategorize') moveToCategory(ids, undefined);
					if (action === 'new-category') createCategory(ids);
					if (action === 'rename') {
						setEditingTitle(title);
						setEditingSessionId(session.id);
					}
					if (action === 'open-location') {
						void window.agent.openSessionFolder(session.id);
					}
					if (action === 'clear' || action === 'compact')
						setPendingAction({ action, id: session.id, title });
					if (action === 'pin') togglePin(targets);
					if (action === 'archive') archiveSessions(targets);
					if (action === 'delete') deleteSessions(targets);
				});
		};
		return (
			<li key={session.id} className="group/item relative flex min-w-0 items-center">
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
							'h-7 min-w-0 flex-1 text-muted-foreground group-hover/item:bg-sidebar-accent',
							isActive && SPLIT_ITEM_ACTIVE_CLASS,
							isSelected && 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-inset ring-sidebar-ring'
						)}
						aria-pressed={isSelected ? true : undefined}
						data-run-status={session.runStatus}
						draggable
						onDragStart={(event) => {
							event.dataTransfer.setData(SESSION_MIME, selectionTargets(session).map((item) => item.id).join('\n'));
							event.dataTransfer.effectAllowed = 'move';
						}}
						onDragEnd={() => setDropTarget(undefined)}
						onClick={(event) => {
							if (select(event)) return;
							setSessionId(session.id);
							setSessionTitle?.(title, session.id);
							navigate('/home');
							window.dispatchEvent(new Event('kucedr:show-chat'));
						}}
						onKeyDown={(event) => {
							if (event.key !== 'Delete' && event.key !== 'Backspace') return;
							event.preventDefault();
							deleteSessions(selectionTargets(session));
						}}
						onContextMenu={(event) => {
							event.preventDefault();
							openMenu();
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
				{editingSessionId !== session.id && (
					<div className="absolute right-1 flex bg-sidebar-accent opacity-0 group-hover/item:opacity-100 focus-within:opacity-100 before:pointer-events-none before:absolute before:inset-y-0 before:right-full before:w-6 before:bg-linear-to-l before:from-sidebar-accent before:to-transparent">
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label={session.pinned ? t('common.unpin', 'Unpin') : t('common.pin', 'Pin')}
							onClick={() => togglePin([session])}
						>
							{session.pinned ? <PinOff /> : <Pin />}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label={t('common.more', 'More')}
							onClick={openMenu}
						>
							<MoreVertical />
						</Button>
					</div>
				)}
			</li>
		);
	};

	return (
		<div data-slot="home-sidebar" className="flex h-full min-h-0 flex-col">
			<header className="shrink-0 px-2 pt-2">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							type="button"
							className="px-2.5 text-sm"
							aria-label={t('navigationBar.newChat', 'New chat')}
							onClick={() => {
								playSound('navigate');
								setSessionId(crypto.randomUUID());
								navigate('/home');
								if (sessions.length === 0)
									setSessionTitle?.(t('navigationBar.newChat', 'New chat'));
								window.dispatchEvent(new Event('kucedr:focus-chat-input'));
							}}
						>
							<Plus className="size-4 shrink-0" />
							<span className="truncate">{t('navigationBar.newChat', 'New Chat')}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							type="button"
							className="px-2.5 text-sm"
							onClick={() => {
								playSound('navigate');
								navigate('/workspace');
							}}
						>
							<Folders className="size-4 shrink-0" />
							<span className="truncate">{t('settings.workspace.title', 'Workspace')}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					{openExtension && (
						<SidebarMenuItem>
							<SidebarMenuButton
								type="button"
								className={cn('px-2.5 text-sm', SPLIT_ITEM_ACTIVE_CLASS)}
								aria-current="page"
							>
								{openExtension.icon ? (
									<img src={openExtension.icon} alt="" className="size-4 shrink-0 object-contain" />
								) : (
									<LayoutPanelLeft className="size-4 shrink-0" />
								)}
								<span className="truncate">{openExtension.title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					)}
				</SidebarMenu>
			</header>
			<section
				className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2 pt-3"
				aria-busy={loading}
				onKeyDown={(event) => {
					if (event.key === 'Escape') clearSelection();
				}}
			>
				{pinnedSessions.length > 0 &&
					renderGroup(
						'pinned',
						t('settings.chatHistory.pinned', 'Pinned'),
						<nav aria-label={t('settings.chatHistory.pinned', 'Pinned')}>
							<ul className="flex min-w-0 flex-col gap-1">{pinnedSessions.map(renderSession)}</ul>
						</nav>,
						{}
					)}
				{categories.map((category) => {
					const categorySessions = activeSessions.filter((session) => !session.pinned && assignments[session.id] === category.id);
					return renderGroup(
						category.id,
						category.name,
						<nav aria-label={category.name}>
							{categorySessions.length === 0 ? (
								<p className="px-2 py-1 text-xs text-muted-foreground">
									{t('settings.chatHistory.emptyCategory', 'Drag chats here')}
								</p>
							) : (
								<ul className="flex min-w-0 flex-col gap-1">{categorySessions.map(renderSession)}</ul>
							)}
						</nav>,
						{ className: 'mb-2', drop: category.id }
					);
				})}
				{renderGroup(
					'history',
					t('settings.chatHistory.history', 'History'),
					<>
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
				) : activeSessions.length === 0 ? (
					<p className="px-2 py-1 text-xs text-muted-foreground">
						{t('settings.chatHistory.empty')}
					</p>
				) : (
					<nav aria-label={t('settings.chatHistory.title')}>
						<ul className="flex min-w-0 flex-col gap-1">
							{recentSessions.map(renderSession)}
						</ul>
					</nav>
				)}
					</>,
					{ drop: null }
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
			<AppSidebarFooter />
		</div>
	);
}
