import React, { type ReactNode } from 'react';
import { Menu, Search, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavigationBarContainer } from './NavigationBarContainer';
import { NavigationBarLeftContainer } from './NavigationBarLeftContainer';
import { Button } from '@/components/ui/button';
import { NavigationBarProvider } from './context/NavigationBarContext';
// import { NavigationButtons } from './components/NavigationButtons';
import { WindowControls } from './components/WindowControls';
import { useWindowState } from './hooks/useWindowState';
import { LogoView } from '@/components/app/base/logo-view';
import { cn } from '@/lib/utils';

// Synchronous platform check — no hooks, no async, no state.
// macOS uses native traffic-light buttons; every other OS needs custom controls.
const isMac =
	typeof navigator !== 'undefined' &&
	(navigator.platform === 'MacIntel' || navigator.platform.startsWith('Mac'));

export interface NavigationBarProps {
	/** Optional class applied to the navigation bar container */
	className?: string;
	/** Custom content rendered on the right before window controls */
	rightContent?: ReactNode;
	/** Route context rendered inside the navigation bar */
	centerContent?: ReactNode;
	/** Optional positioning override for route context */
	centerContentClassName?: string;
	/** Opens the global route and settings search */
	onSearch?: () => void;
}

export const NavigationBar = React.memo(function NavigationBar({
	className,
	rightContent,
	centerContent,
	centerContentClassName,
	onSearch,
}: NavigationBarProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const { isFullScreen, isMaximized } = useWindowState();

	const isHome = location.pathname === '/home';
	const isOnboarding = ['/start', '/auth', '/setup', '/config'].includes(location.pathname);
	const isSettings = location.pathname.startsWith('/settings');
	const settingsLabel = t('settings.title', 'Settings');
	const homeButtonLabel = t('navigationBar.home', 'Home');
	const searchLabel = t('navigationBar.search', 'Search');
	const navigationBarMenuItems = [
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
