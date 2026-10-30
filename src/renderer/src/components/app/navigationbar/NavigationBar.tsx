import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Menu, MessageCircle, Moon, Plus, Search, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavigationBarContainer } from './NavigationBarContainer';
import { NavigationBarLeftContainer } from './NavigationBarLeftContainer';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { useApp } from '@/contexts';
import { usePageContext } from '@/components/app/base/page/hooks/use-page-context';
import { NavigationBarProvider } from './context/NavigationBarContext';
import { useCommandMenu } from '@/contexts/command-menu';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DEFAULT_CHAT_SESSION_ID, useChatSession } from '@/contexts/chat-session';
import type { AgentSessionSummary } from '@/lib/compat';
import { revealSelection } from '@/lib/selection';
import { playSound } from '@/lib/sounds/play';
// import { NavigationButtons } from './components/NavigationButtons';
import { WindowControls } from './components/WindowControls';
import { useWindowState } from './hooks/useWindowState';

// Synchronous platform check — no hooks, no async, no state.
// macOS uses native traffic-light buttons; every other OS needs custom controls.
const isMac =
	typeof navigator !== 'undefined' &&
	(navigator.platform === 'MacIntel' || navigator.platform.startsWith('Mac'));
const actionGroupClassName = 'flex h-full items-center gap-1';

export interface NavigationBarProps {
	/** Optional class applied to the navigation bar container */
	className?: string;
	startContent?: ReactNode;
	contextContent?: ReactNode;
	/** Custom content rendered on the right before window controls */
	rightContent?: ReactNode;
	/** Shows the Workspace entry on app routes with a sidebar */
	showWorkspace?: boolean;
}

export const NavigationBar = React.memo(function NavigationBar({
	className,
	startContent,
	contextContent,
	rightContent,
	showWorkspace,
}: NavigationBarProps) {
	const { t } = useTranslation();
	const { theme, setTheme } = useApp();
	const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
	useEffect(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = (): void => setSystemDark(media.matches);
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}, []);
	const isDark = theme === 'dark' || (theme === 'system' && systemDark);
	const ThemeIcon = isDark ? Sun : Moon;
	const nextTheme = isDark ? 'light' : 'dark';
	const themeLabel = `${t('settings.theme.title')}: ${t(`settings.theme.${nextTheme}`)}`;
	const navigate = useNavigate();
	const location = useLocation();
	const { isFullScreen, isMaximized } = useWindowState();
	const { open: openCommandMenu } = useCommandMenu();
	const { sessionId, sessionTitle, setSessionId, setSessionTitle } = useChatSession();
	const { state, isMobile } = usePageContext();
	const isLibrary = location.pathname === '/home/library';
	const sidebarExpanded = showWorkspace && !isMobile && state.sidebarOpen;
	const [chatSessions, setChatSessions] = useState<AgentSessionSummary[]>([]);
	const [chatSessionsLoading, setChatSessionsLoading] = useState(false);
	const [chatSessionsLoadError, setChatSessionsLoadError] = useState(false);
	const chatSessionsRef = useRef<HTMLDivElement>(null);

	const isHome = location.pathname === '/home';
	const isWorkspace = location.pathname === '/workspace';
	const isCode = location.pathname === '/code' || location.pathname.startsWith('/code/');
	const isOnboarding = ['/start', '/auth', '/setup', '/config'].includes(location.pathname);
	const isSettings = location.pathname.startsWith('/settings');
	const chatButtonLabel = t('navigationBar.chat', 'Chat');
	const homeLabel = t('navigationBar.chat', 'Chat');
	const searchLabel = t('navigationBar.search');
	const workspaceLabel = t('settings.workspace.title', 'Workspace');
	const chatHistoryLabel = t('settings.chatHistory.title');
	const newChatLabel = t('navigationBar.newChat', 'New chat');
	const chatButtonVariant = isHome || isSettings ? 'secondary' : 'ghost';
	const activeChatSessionId = sessionId === DEFAULT_CHAT_SESSION_ID ? chatSessions[0]?.id : sessionId;
	useEffect(() => {
		if (!chatSessionsLoading && chatSessionsRef.current) revealSelection(chatSessionsRef.current);
	}, [activeChatSessionId, chatSessions, chatSessionsLoading]);
	const chatNavigationButton = (
		<Button
			type="button"
			variant={chatButtonVariant}
			size="sm"
			className={isHome ? '!rounded-r-none text-xs' : 'rounded-md text-xs'}
			onClick={() => navigate('/home')}
			aria-label={homeLabel}
			aria-current={isHome ? 'page' : undefined}
		>
			<MessageCircle className="size-3.5" strokeWidth={1.8} />
			<span>{homeLabel}</span>
		</Button>
	);
	const chatButtonTooltip = (
		<Tooltip>
			<TooltipTrigger render={chatNavigationButton} />
			<TooltipContent side="bottom">{homeLabel}</TooltipContent>
		</Tooltip>
	);
	const navigationButtons = showWorkspace ? (
		<>
			{isHome ? (
			<ButtonGroup role="group" aria-label={homeLabel}>
				{chatButtonTooltip}
				<DropdownMenu
					onOpenChange={(open) => {
						if (!open) return;
						setChatSessionsLoading(true);
						setChatSessionsLoadError(false);
						void window.agent.listSessions().then(
							(sessions) => setChatSessions(sessions),
							() => setChatSessionsLoadError(true)
						).finally(() => setChatSessionsLoading(false));
					}}
				>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant={chatButtonVariant}
							size="icon-sm"
							className="!rounded-l-none border-l-0"
							aria-label={chatHistoryLabel}
						>
							<ChevronDown className="size-4" strokeWidth={1.8} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" side="bottom" className="w-72 overflow-hidden">
						<div className="flex items-center justify-between gap-2 px-2 py-1.5">
							<DropdownMenuLabel className="p-0">{chatHistoryLabel}</DropdownMenuLabel>
							<DropdownMenuItem
								className="gap-1 px-2 py-1 text-xs"
								onSelect={() => {
									playSound('navigate');
									const newSessionId = crypto.randomUUID();
									setSessionId(newSessionId);
									setSessionTitle?.(newChatLabel, newSessionId);
									navigate('/home');
									window.requestAnimationFrame(() =>
										window.dispatchEvent(new Event('kucedr:focus-chat-input'))
									);
								}}
							>
								<Plus className="size-3" />
								New
							</DropdownMenuItem>
						</div>
						<DropdownMenuSeparator />
						<div ref={chatSessionsRef} className="max-h-56 overflow-y-auto">
							{chatSessionsLoading ? (
								<div className="px-2 py-3 text-sm text-muted-foreground">
									{t('settings.chatHistory.loading')}
								</div>
							) : chatSessionsLoadError ? (
								<div className="px-2 py-3 text-sm text-muted-foreground">
									{t('settings.chatHistory.errors.load')}
								</div>
							) : chatSessions.length === 0 ? (
								<div className="px-2 py-3 text-sm text-muted-foreground">
									{t('settings.chatHistory.empty')}
								</div>
							) : chatSessions.map((session) => {
								const title = session.title.trim() || t('settings.chatHistory.untitled');
								const isActiveSession = session.id === activeChatSessionId;
								return (
									<DropdownMenuItem
										key={session.id}
										aria-current={isActiveSession ? 'page' : undefined}
										className={isActiveSession ? 'bg-accent text-accent-foreground' : undefined}
										onSelect={() => {
											setSessionId(session.id);
											setSessionTitle?.(title, session.id);
											navigate('/home');
											window.requestAnimationFrame(() =>
												window.dispatchEvent(new Event('kucedr:focus-chat-input'))
											);
										}}
									>
										<span className="truncate">{title}</span>
									</DropdownMenuItem>
								);
							})}
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>
			) : chatButtonTooltip}
			<span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
			<Tooltip>
				<TooltipTrigger render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8 rounded-full"
						onClick={() => {
							playSound('navigate');
							openCommandMenu();
						}}
						aria-label={searchLabel}
					>
						<Search className="size-4" strokeWidth={1.8} />
					</Button>
				} />
				<TooltipContent side="bottom">{searchLabel}</TooltipContent>
			</Tooltip>
		</>
	) : null;
	return (
		<NavigationBarProvider value={{ isMac, isFullScreen }}>
			<NavigationBarContainer
				className={className}
			>
				{/* ── Left: platform menu + nav buttons ── */}
				<NavigationBarLeftContainer
					isMac={isMac && !sidebarExpanded}
					isFullScreen={isFullScreen}
					className="min-w-0 shrink transition-[width] duration-200 motion-reduce:transition-none"
				>
					<div
						data-slot="navigationbar-sidebar-actions"
						className={`${actionGroupClassName} shrink-0 overflow-hidden`}
					>
						{!isMac && (
							<Tooltip>
								<TooltipTrigger render={
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={t('navigationBar.applicationMenu')}
										onClick={() => window.win?.popupMenu()}
										className="ml-2 rounded-full"
									>
										<Menu className="size-4" strokeWidth={1.5} />
									</Button>
								} />
								<TooltipContent side="bottom">{t('navigationBar.applicationMenu')}</TooltipContent>
							</Tooltip>
						)}
						{startContent}

					</div>
					{!isHome && !isWorkspace && !isOnboarding && !isSettings && !isCode && (
						<Tooltip>
							<TooltipTrigger render={
								<Button
									type="button"
									aria-label={chatButtonLabel}
									variant="default"
									size="xs"
									onClick={() => navigate('/home')}
								>
									{chatButtonLabel}
								</Button>
							} />
							<TooltipContent side="bottom">{chatButtonLabel}</TooltipContent>
						</Tooltip>
					)}

					{showWorkspace && (
						<div data-slot="navigationbar-context" className="flex min-w-0 items-center gap-3 px-3 text-sm" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
							<span className="shrink-0 font-medium text-muted-foreground">{isHome ? homeLabel : isWorkspace ? workspaceLabel : isLibrary ? t('settings.library.title', 'Library') : t('settings.title')}</span>
							{contextContent}
							{isHome && <><span aria-hidden="true" className="text-muted-foreground/50">/</span><span className="truncate font-medium">{sessionTitle || newChatLabel}</span></>}
						</div>
					)}
				</NavigationBarLeftContainer>

				<div className="flex-1" />

				{/* ── Right actions ── */}
				<div
					className={`z-10 mr-3 ${actionGroupClassName}`}
				>
					{navigationButtons}
					<Tooltip>
						<TooltipTrigger render={
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8 rounded-full"
								onClick={() => setTheme(nextTheme)}
								aria-label={themeLabel}
							>
								<ThemeIcon className="size-4" strokeWidth={1.8} />
							</Button>
						} />
						<TooltipContent side="bottom">{themeLabel}</TooltipContent>
					</Tooltip>
					{rightContent && (
						<div className="flex h-full items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
							{rightContent}
						</div>
					)}
				</div>

				{!isMac && <WindowControls isMaximized={isMaximized} />}
			</NavigationBarContainer>
		</NavigationBarProvider>
	);
});
NavigationBar.displayName = 'NavigationBar';
