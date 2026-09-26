import { PanelLeft, PanelRight, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavigationBarContainer } from '@/components/app/navigationbar/NavigationBarContainer';
import { NavigationBarLeftContainer } from '@/components/app/navigationbar/NavigationBarLeftContainer';
import { WindowControls } from '@/components/app/navigationbar/components/WindowControls';
import { useWindowState } from '@/components/app/navigationbar/hooks/useWindowState';

const isMac = navigator.platform.startsWith('Mac');

interface NavigationProps {
	readonly sidebar: boolean;
	readonly viewer: boolean;
	readonly workspaceName: string;
	readonly canRun: boolean;
	readonly onToggleSidebar: () => void;
	readonly onToggleViewer: () => void;
	readonly onRun: () => void;
}

export function Navigation({
	sidebar,
	viewer,
	workspaceName,
	canRun,
	onToggleSidebar,
	onToggleViewer,
	onRun,
}: NavigationProps) {
	const { isFullScreen, isMaximized } = useWindowState();
	return (
		<NavigationBarContainer>
			<NavigationBarLeftContainer isMac={isMac} isFullScreen={isFullScreen} className="min-w-0">
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="size-8 shrink-0"
					aria-label="Run current prompt"
					title="Run current prompt"
					disabled={!canRun}
					onClick={onRun}
				>
					<Play className="size-4" />
				</Button>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="size-8 shrink-0"
					aria-label="Stop current run"
					title="Stop current run"
					disabled
				>
					<Square className="size-4" />
				</Button>
				<span className="truncate px-2 text-sm font-medium" title={workspaceName}>
					{workspaceName}
				</span>
			</NavigationBarLeftContainer>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="ml-auto size-8 shrink-0 rounded-full text-muted-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground"
				aria-label="Toggle sessions"
				title="Toggle sessions"
				aria-expanded={sidebar}
				onClick={onToggleSidebar}
			>
				<PanelLeft className="size-4" strokeWidth={1.8} />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="mr-3 size-8 shrink-0 rounded-full text-muted-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground"
				aria-label="Toggle content viewer"
				title="Toggle content viewer"
				aria-expanded={viewer}
				onClick={onToggleViewer}
			>
				<PanelRight className="size-4" strokeWidth={1.8} />
			</Button>
			{!isMac && (
				<div className="h-full">
					<WindowControls isMaximized={isMaximized} />
				</div>
			)}
		</NavigationBarContainer>
	);
}
