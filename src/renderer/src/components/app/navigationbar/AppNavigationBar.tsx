import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Menu } from 'lucide-react';
import type { AppNavigationBarButton as AppNavigationBarButtonDescriptor } from '@shared/window_types';
import { Button } from '@/components/ui/button';
import { NavigationBarContainer } from './NavigationBarContainer';
import { NavigationBarLeftContainer } from './NavigationBarLeftContainer';
import { NavigationBarRightContainer } from './NavigationBarRightContainer';
import { AppNavigationBarButton } from './AppNavigationBarButton';
import { WindowControls } from './components/WindowControls';
import { useAppWindowState } from './hooks/useAppWindowState';

const isMac =
	typeof navigator !== 'undefined' &&
	(navigator.platform === 'MacIntel' || navigator.platform.startsWith('Mac'));

interface AppNavigationBarProps {
	readonly leftButtons?: AppNavigationBarButtonDescriptor[];
	readonly rightButtons?: AppNavigationBarButtonDescriptor[];
}

export function AppNavigationBar({
	leftButtons = [],
	rightButtons = [],
}: AppNavigationBarProps): React.JSX.Element {
	const isMaximized = useAppWindowState();

	return (
		<NavigationBarContainer>
			<NavigationBarLeftContainer isMac={isMac}>
				{!isMac ? (
					<Tooltip>
						<TooltipTrigger render={
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="ml-2 rounded-full"
								onClick={() => window.win.popupMenu()}
								aria-label="Application menu"
							>
								<Menu strokeWidth={1.5} />
							</Button>
						} />
						<TooltipContent side="bottom">{"Application menu"}</TooltipContent>
					</Tooltip>
				) : null}
				{leftButtons.map((button) => (
					<AppNavigationBarButton key={button.id} button={button} />
				))}
			</NavigationBarLeftContainer>
			<div className="flex-1" />
			{rightButtons.length > 0 ? (
				<NavigationBarRightContainer className={isMac ? 'mr-3' : undefined}>
					{rightButtons.map((button) => (
						<AppNavigationBarButton key={button.id} button={button} />
					))}
				</NavigationBarRightContainer>
			) : null}
			{!isMac ? <WindowControls isMaximized={isMaximized} /> : null}
		</NavigationBarContainer>
	);
}
