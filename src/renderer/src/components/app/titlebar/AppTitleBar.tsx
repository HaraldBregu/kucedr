import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TitleBarCenterContainer } from './TitleBarCenterContainer';
import { TitleBarCenterContainerTitle } from './TitleBarCenterContainerTitle';
import { TitleBarContainer } from './TitleBarContainer';
import { TitleBarLeftContainer } from './TitleBarLeftContainer';
import { TitleBarRightContainer } from './TitleBarRightContainer';
import { AppWindowControls } from './AppWindowControls';
import { AppTitlebarButton } from './AppTitlebarButton';
import { useAppWindowState } from './hooks/useAppWindowState';
import { cn } from '@/lib/utils';
import type { AppTitlebarButton as AppTitlebarButtonDescriptor } from '../../../../../shared/window_types';

const isMac =
	typeof navigator !== 'undefined' &&
	(navigator.platform === 'MacIntel' || navigator.platform.startsWith('Mac'));

interface AppTitleBarProps {
	title: string;
	leftButtons?: AppTitlebarButtonDescriptor[];
	rightButtons?: AppTitlebarButtonDescriptor[];
	sidebarOpen?: boolean;
	sidebarTransitionDelay?: number;
	sidebarWidth?: number | null;
}

export function AppTitleBar({
	title,
	leftButtons = [],
	rightButtons = [],
	sidebarOpen,
	sidebarTransitionDelay,
	sidebarWidth = null,
}: AppTitleBarProps): React.JSX.Element {
	const isMaximized = useAppWindowState();
	const sidebarOffset = sidebarOpen && sidebarWidth !== null ? sidebarWidth : 0;
	const transitionDelay =
		sidebarTransitionDelay === undefined ? undefined : `${sidebarTransitionDelay}ms`;

	return (
		<TitleBarContainer className="relative">
			{sidebarWidth !== null ? (
				<div
					data-slot="app-titlebar-sidebar"
					data-state={sidebarOpen === undefined ? undefined : sidebarOpen ? 'expanded' : 'collapsed'}
					aria-hidden="true"
					className={cn(
						'pointer-events-none absolute inset-y-0 left-0 overflow-hidden border-r border-sidebar-border bg-sidebar duration-200 ease-linear motion-reduce:transition-none',
						sidebarOpen === undefined ? 'transition-[width]' : 'transition-transform'
					)}
					style={{
						width: sidebarWidth,
						transitionDelay,
						transform:
							sidebarOpen === undefined
								? undefined
								: sidebarOpen
									? 'translateX(0)'
									: 'translateX(-100%)',
					}}
				/>
			) : null}
			<TitleBarLeftContainer isMac={isMac}>
				{!isMac ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="ml-2 size-7 rounded-md text-muted-foreground"
						onClick={() => window.win.popupMenu()}
						title="Application menu"
						aria-label="Application menu"
					>
						<Menu className="size-[15px]" strokeWidth={1.5} />
					</Button>
				) : null}
				{leftButtons.map((button) => (
					<AppTitlebarButton key={button.id} button={button} />
				))}
			</TitleBarLeftContainer>
			<TitleBarCenterContainer
				className="transition-[left] duration-200 ease-linear motion-reduce:transition-none"
				style={{ left: sidebarOffset, transitionDelay }}
			>
				<TitleBarCenterContainerTitle
					className={
						isMac ? 'max-w-[calc(100%-180px)] truncate' : 'max-w-[calc(100%-380px)] truncate'
					}
				>
					{title}
				</TitleBarCenterContainerTitle>
			</TitleBarCenterContainer>
			<div className="flex-1" />
			{rightButtons.length > 0 ? (
				<TitleBarRightContainer className={isMac ? 'mr-3' : undefined}>
					{rightButtons.map((button) => (
						<AppTitlebarButton key={button.id} button={button} />
					))}
				</TitleBarRightContainer>
			) : null}
			{!isMac ? <AppWindowControls isMaximized={isMaximized} /> : null}
		</TitleBarContainer>
	);
}
