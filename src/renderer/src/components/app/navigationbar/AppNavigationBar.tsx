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
		<NavigationBarContainer className="relative">
			<NavigationBarLeftContainer isMac={isMac}>
				{!isMac ? (
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="ml-2 text-muted-foreground"
						onClick={() => window.win.popupMenu()}
						title="Application menu"
						aria-label="Application menu"
					>
						<Menu strokeWidth={1.5} />
					</Button>
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
