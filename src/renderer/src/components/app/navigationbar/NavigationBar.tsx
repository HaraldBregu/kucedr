import React, { type ReactNode } from 'react';
import { Folder, FolderOpen, Menu, Search, Trash2, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavigationBarContainer } from './NavigationBarContainer';
import { NavigationBarLeftContainer } from './NavigationBarLeftContainer';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NavigationBarProvider } from './context/NavigationBarContext';
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

export interface NavigationBarProps {
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
	/** Whether the desktop sidebar occupies the left edge of the navigationbar. */
	sidebarOpen?: boolean;
}

export const NavigationBar = React.memo(function NavigationBar({
	className,
	style,
	rightContent,
	centerContent,
	centerContentClassName,
	onSearch,
	showSidebarToggles: _showSidebarToggles = false,
	sidebarOpen = false,
}: NavigationBarProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const { isFullScreen, isMaximized } = useWindowState();
	const { sessionId, sessionTitle, sessionTitleSessionId, setSessionId } = useChatSession();

	const isHome = location.pathname === '/home';
	const isOnboarding = ['/start', '/auth', '/setup', '/config'].includes(location.pathname);
	const isSettings = location.pathname.startsWith('/settings');
	const settingsLabel = t('settings.title', 'Settings');
	const homeButtonLabel = t('navigationBar.home', 'Home');
	const searchLabel = t('navigationBar.search', 'Search');
	const chatTitle = sessionTitle ?? (isHome ? t('navigationBar.newChat', 'New chat') : undefined);
	const activeChatSessionId = sessionTitleSessionId ?? sessionId;
	const navigationbarMenuItems = [
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
		<NavigationBarProvider value={{ isMac, isFullScreen }}>
			<NavigationBarContainer
				className={cn(className, isOnboarding && 'bg-background')}
				style={style}
				onContextMenu={(event) => {
					if (event.target instanceof Element && event.target.closest('button, a')) {
						return;
					}

					event.preventDefault();
					void window.win
						.showContextMenu(
							navigationbarMenuItems.map((item) => ({ id: item.path, label: item.label }))
						)
						.then((path) => {
							if (path) navigate(path);
						});
				}}
			>
				{isHome && chatTitle ? (
					<div
						data-slot="navigationbar-chat-context"
						className={cn(
							'flex min-w-0 items-center gap-1 transition-[margin] duration-200 ease-linear motion-reduce:transition-none',
							sidebarOpen ? 'ml-3' : 'ml-28'
						)}
					>
						{sessionTitleSessionId ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={t('settings.chatHistory.title')}
										style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
									>
										<Folder className="size-4" aria-hidden="true" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="w-44">
									<DropdownMenuItem
										onSelect={() => void window.agent.openSessionFolder(activeChatSessionId)}
									>
										<FolderOpen />
										{t('navigationBar.openLocation', 'Open location')}
									</DropdownMenuItem>
									<DropdownMenuItem
										className="text-destructive focus:bg-destructive/10 focus:text-destructive"
										onSelect={() => {
											if (
												!window.confirm(
													t('settings.chatHistory.confirmDeleteSession', { title: chatTitle })
												)
											) {
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
									{navigationbarMenuItems.map((item) => (
										<DropdownMenuItem key={item.path} onSelect={() => navigate(item.path)}>
											{item.label}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
						<span
							data-slot="navigationbar-chat-title"
							className="min-w-0 max-w-72 truncate text-sm font-medium"
						>
							{chatTitle}
						</span>
					</div>
				) : null}

				{/* ── Left: platform menu + nav buttons ── */}
				<NavigationBarLeftContainer isMac={isMac} isFullScreen={isFullScreen}>
					{!isMac && (
						<button
							type="button"
							onClick={() => window.win?.popupMenu()}
							className="ml-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground"
							title={t('navigationBar.applicationMenu')}
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
				</NavigationBarLeftContainer>

				{centerContent && (
					<div
						data-slot="navigationbar-content"
						className={cn(
							'pointer-events-none absolute inset-y-0 flex min-w-0 items-center overflow-hidden',
							isMac ? 'left-4 right-16' : 'left-24 right-28',
							centerContentClassName
						)}
					>
						<div className="pointer-events-auto min-w-0 max-w-full">{centerContent}</div>
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
			</NavigationBarContainer>
		</NavigationBarProvider>
	);
});
NavigationBar.displayName = 'NavigationBar';
