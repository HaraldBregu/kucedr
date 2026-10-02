import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import React, { useEffect, useState, type ReactNode } from 'react';
import { House, Menu, Moon, PanelsTopLeft, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavigationBarContainer } from './NavigationBarContainer';
import { NavigationBarLeftContainer } from './NavigationBarLeftContainer';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts';
import { NavigationBarProvider } from './context/NavigationBarContext';
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
	/** Custom content rendered on the right before window controls */
	rightContent?: ReactNode;
	/** Shows the Workspace entry on app routes with a sidebar */
	showWorkspace?: boolean;
}

export const NavigationBar = React.memo(function NavigationBar({
	className,
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

	const isHome = location.pathname === '/home';
	const isWorkspace = location.pathname === '/workspace';
	const isOnboarding = ['/start', '/auth', '/setup', '/config'].includes(location.pathname);
	const isSettings = location.pathname.startsWith('/settings');
	const chatButtonLabel = t('navigationBar.chat', 'Chat');
	const workspaceLabel = t('navigationBar.space', 'Space');
	const homeLabel = t('navigationBar.home', 'Home');
	const navigationBarMenuItems = [
		{ path: '/settings/settings', label: t('settings.tabs.settings') },
		{ path: '/settings/agent', label: t('settings.overview.groups.agent') },
		{ path: '/settings/apps', label: t('settings.tabs.apps') },
	];
	const workspaceButton = showWorkspace ? (
		<>
			<Tooltip>
				<TooltipTrigger render={
					<Button
						type="button"
						variant={isWorkspace ? 'secondary' : 'ghost'}
						size="sm"
						className="rounded-md text-xs"
						onClick={() => navigate('/workspace')}
						aria-label={workspaceLabel}
						aria-current={isWorkspace ? 'page' : undefined}
					>
						<PanelsTopLeft className="size-3.5" strokeWidth={1.8} />
						<span>{workspaceLabel}</span>
					</Button>
				} />
				<TooltipContent side="bottom">{workspaceLabel}</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger render={
					<Button
						type="button"
						variant={isHome ? 'secondary' : 'ghost'}
						size="sm"
						className="rounded-md text-xs"
						onClick={() => navigate('/home')}
						aria-label={homeLabel}
						aria-current={isHome ? 'page' : undefined}
					>
						<House className="size-3.5" strokeWidth={1.8} />
						<span>{homeLabel}</span>
					</Button>
				} />
				<TooltipContent side="bottom">{homeLabel}</TooltipContent>
			</Tooltip>
		</>
	) : null;
	return (
		<NavigationBarProvider value={{ isMac, isFullScreen }}>
			<NavigationBarContainer
				className={className}
				onContextMenu={(event) => {
					if (event.target instanceof Element && event.target.closest('button, a')) {
						return;
					}

					event.preventDefault();
					void window.win
						.showContextMenu(
							navigationBarMenuItems.map((item) => ({ id: item.path, label: item.label }))
						)
						.then((path) => {
							if (path) navigate(path);
						});
				}}
			>
				{/* ── Left: platform menu + nav buttons ── */}
				<NavigationBarLeftContainer
					isMac={isMac}
					isFullScreen={isFullScreen}
					className={isMac ? 'ml-[84px]' : undefined}
				>
					<div
						data-slot="navigationbar-sidebar-actions"
						className={actionGroupClassName}
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
						<span data-slot="split-pane-toggle-target" className="contents" />
					</div>
					{!isHome && !isWorkspace && !isOnboarding && !isSettings && (
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

					{/* {isSettings && <NavigationButtons />} */}
				</NavigationBarLeftContainer>

				<div className="flex-1" />

				{rightContent && (
					<div
						className="z-10 mr-3 flex h-full items-center"
						style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
					>
						{rightContent}
					</div>
				)}

				{/* ── Right actions ── */}
				<div
					className={`z-10 mr-3 ${actionGroupClassName}`}
				>
					{workspaceButton}
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
				</div>

				{!isMac && <WindowControls isMaximized={isMaximized} />}
			</NavigationBarContainer>
		</NavigationBarProvider>
	);
});
NavigationBar.displayName = 'NavigationBar';
