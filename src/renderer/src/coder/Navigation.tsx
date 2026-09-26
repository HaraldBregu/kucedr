import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavigationBarContainer } from '@/components/app/navigationbar/NavigationBarContainer';
import { NavigationBarLeftContainer } from '@/components/app/navigationbar/NavigationBarLeftContainer';
import { WindowControls } from '@/components/app/navigationbar/components/WindowControls';
import { useWindowState } from '@/components/app/navigationbar/hooks/useWindowState';

const isMac = navigator.platform.startsWith('Mac');

interface NavigationProps {
	readonly sidebar: boolean;
	readonly onToggleSidebar: () => void;
}

export function Navigation({ sidebar, onToggleSidebar }: NavigationProps) {
	const { isFullScreen, isMaximized } = useWindowState();
	return (
		<NavigationBarContainer>
			<NavigationBarLeftContainer isMac={isMac} isFullScreen={isFullScreen} className="min-w-0">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 shrink-0 rounded-full text-muted-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground"
					aria-label="Toggle sessions"
					title="Toggle sessions"
					aria-expanded={sidebar}
					onClick={onToggleSidebar}
				>
					<PanelLeft className="size-4" strokeWidth={1.8} />
				</Button>
			</NavigationBarLeftContainer>
			{!isMac && (
				<div className="ml-auto h-full">
					<WindowControls isMaximized={isMaximized} />
				</div>
			)}
		</NavigationBarContainer>
	);
}
