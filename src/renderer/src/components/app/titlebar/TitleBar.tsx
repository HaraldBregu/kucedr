import React, { type ReactNode } from 'react';
import { Menu, MessageCircle, Pencil, Search, Trash2, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { TitleBarContainer } from './TitleBarContainer';
import { TitleBarLeftContainer } from './TitleBarLeftContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TitleBarProvider } from './context/TitleBarContext';
// import { NavigationButtons } from './components/NavigationButtons';
import { WindowControls } from './components/WindowControls';
import { useWindowState } from './hooks/useWindowState';
import { LogoView } from '@/components/app/base/logo-view';
import { useChatSession } from '@/contexts/chat-session';
import { cn } from '@/lib/utils';

// Synchronous platform check — no hooks, no async, no state.
// macOS uses native traffic-light buttons; every other OS needs custom controls.
const isMac =
	typeof navigator !== 'undefined' &&
	(navigator.platform === 'MacIntel' || navigator.platform.startsWith('Mac'));

export interface TitleBarProps {
	/** Optional class applied to the title bar container */
	className?: string;
	/** Optional inline style applied to the title bar container */
	style?: React.CSSProperties;
	/** Custom content rendered on the right before window controls */
	rightContent?: ReactNode;
	/** Route context rendered inside the title bar */
	centerContent?: ReactNode;
	/** Optional positioning override for route context */
	centerContentClassName?: string;
	/** Opens the global route and settings search */
	onSearch?: () => void;
	/** When true, renders agentic + info sidebar toggle buttons on the right */
	showSidebarToggles?: boolean;
	/** Whether the desktop sidebar occupies the left edge of the titlebar. */
	sidebarOpen?: boolean;
}

export const TitleBar = React.memo(function TitleBar({
	className,
	style,
	rightContent,
	centerContent,
	centerContentClassName,
	onSearch,
	showSidebarToggles: _showSidebarToggles = false,
	sidebarOpen = false,
}: TitleBarProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const { isFullScreen, isMaximized } = useWindowState();
	const { sessionId, sessionTitle, sessionTitleSessionId, setSessionId, setSessionTitle } = useChatSession();
	const [editingChatTitle, setEditingChatTitle] = React.useState<string>();
	const chatTitleInputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		if (editingChatTitle === undefined) return;
		const frame = window.requestAnimationFrame(() => chatTitleInputRef.current?.focus());
		return () => window.cancelAnimationFrame(frame);
	}, [editingChatTitle]);

	const isHome = location.pathname === '/home';
	const isOnboarding = ['/start', '/auth', '/setup', '/config'].includes(location.pathname);
	const isSettings = location.pathname.startsWith('/settings');
	const settingsLabel = t('settings.title', 'Settings');
	const homeButtonLabel = t('titleBar.home', 'Home');
	const searchLabel = t('titleBar.search', 'Search');
	const activeChatSessionId = sessionTitleSessionId ?? sessionId;
	const titlebarMenuItems = [
		{ path: '/settings/general', label: t('settings.tabs.general') },
		{ path: '/settings/agent', label: t('settings.overview.groups.agent') },
		{ path: '/settings/system', label: t('settings.tabs.system') },
		{ path: '/settings/apps', label: t('settings.tabs.apps') },
	];
	const searchButton = onSearch ? (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="size-8 rounded-full"
			onClick={onSearch}
			title={searchLabel}
			aria-label={searchLabel}
		>
			<Search className="size-4" strokeWidth={1.8} />
		</Button>
	) : null;
	const routeButton = isSettings ? (
		<Button
			type="button"
			variant="secondary"
			className="rounded-full"
			onClick={() => navigate('/home')}
			title={homeButtonLabel}
			aria-label={homeButtonLabel}
		>
			<LogoView className="pointer-events-none size-[18px]" />
			{homeButtonLabel}
		</Button>
	) : !isOnboarding ? (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="size-8 rounded-full"
			onClick={() => navigate('/settings/general')}
			title={settingsLabel}
			aria-label={settingsLabel}
		>
			<User className="size-4" strokeWidth={1.8} />
		</Button>
	) : null;
	return (
		<TitleBarProvider value={{ isMac, isFullScreen }}>
			<TitleBarContainer
				className={cn(className, isOnboarding && 'bg-background')}
				style={style}
				onContextMenu={(event) => {
					if (event.target instanceof Element && event.target.closest('button, a')) {
						return;
					}

					event.preventDefault();
					void window.win
						.showContextMenu(titlebarMenuItems.map((item) => ({ id: item.path, label: item.label })))
						.then((path) => {
							if (path) navigate(path);
						});
				}}
			>
				{isHome && sessionTitle ? (
					<div
						data-slot="titlebar-chat-context"
						className={cn(
							'flex min-w-0 items-center gap-1 transition-[margin] duration-200 ease-linear motion-reduce:transition-none',
							sidebarOpen ? 'ml-3' : 'ml-28'
						)}
					>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t('settings.chatHistory.title')}
									style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
								>
									<MessageCircle className="size-4" aria-hidden="true" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-44">
								<DropdownMenuItem onSelect={() => setEditingChatTitle(sessionTitle)}>
									<Pencil />
									{t('common.rename', 'Rename')}
								</DropdownMenuItem>
								<DropdownMenuItem
									className="text-destructive focus:bg-destructive/10 focus:text-destructive"
									onSelect={() => {
										if (!window.confirm(t('settings.chatHistory.confirmDeleteSession', { title: sessionTitle }))) {
											return;
										}
										void window.agent.deleteSession(activeChatSessionId).then(() => {
											setSessionId(crypto.randomUUID());
										});
									}}
								>
									<Trash2 />
									{t('common.delete', 'Delete')}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{titlebarMenuItems.map((item) => (
									<DropdownMenuItem key={item.path} onSelect={() => navigate(item.path)}>
										{item.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
						{editingChatTitle === undefined ? (
							<span data-slot="titlebar-chat-title" className="min-w-0 max-w-72 truncate text-sm font-medium">
								{sessionTitle}
							</span>
						) : (
							<Input
								ref={chatTitleInputRef}
								maxLength={120}
								value={editingChatTitle}
								onChange={(event) => setEditingChatTitle(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter') event.currentTarget.blur();
									if (event.key === 'Escape') {
										event.preventDefault();
										setEditingChatTitle(undefined);
									}
								}}
								onBlur={(event) => {
									const nextTitle = event.currentTarget.value.trim();
									setEditingChatTitle(undefined);
									if (!nextTitle || nextTitle === sessionTitle) return;
									void window.agent.renameSession(activeChatSessionId, nextTitle).then(() => {
										setSessionTitle?.(nextTitle, activeChatSessionId);
									});
								}}
								aria-label={t('common.rename', 'Rename')}
								className="h-8 w-56 text-sm font-medium"
								style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
							/>
						)}
					</div>
				) : null}

				{/* ── Left: platform menu + nav buttons ── */}
				<TitleBarLeftContainer isMac={isMac} isFullScreen={isFullScreen}>
					{!isMac && (
						<button
							type="button"
							onClick={() => window.win?.popupMenu()}
							className="ml-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground"
							title={t('titleBar.applicationMenu')}
						>
							<Menu className="h-[15px] w-[15px]" strokeWidth={1.5} />
						</button>
					)}
					{!isMac && searchButton}
					{!isMac && routeButton}
					{!isHome && !isOnboarding && !isSettings && (
						<Button
							type="button"
							variant="default"
							size="xs"
							onClick={() => navigate('/home')}
							title={homeButtonLabel}
						>
							{homeButtonLabel}
						</Button>
					)}

					{/* {isSettings && <NavigationButtons />} */}
				</TitleBarLeftContainer>

				{centerContent && (
					<div
						data-slot="titlebar-content"
						className={cn(
							'pointer-events-none absolute inset-y-0 flex min-w-0 items-center overflow-hidden',
							isMac ? 'left-4 right-16' : 'left-24 right-28',
							centerContentClassName
						)}
					>
						<div
							className="pointer-events-auto min-w-0 max-w-full"
							style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
						>
							{centerContent}
						</div>
					</div>
				)}

				<div className="flex-1" />

				{rightContent && (
					<div
						className="z-10 mr-3 flex h-full items-center"
						style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
					>
						{rightContent}
					</div>
				)}

				{/* ── Right action: home/settings toggle ── */}
				{isMac && (searchButton || routeButton) && (
					<div
						className="z-10 mr-3 flex h-full items-center gap-1"
						style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
					>
						{searchButton}
						{routeButton}
					</div>
				)}

				{!isMac && <WindowControls isMaximized={isMaximized} />}
			</TitleBarContainer>
		</TitleBarProvider>
	);
});
TitleBar.displayName = 'TitleBar';
