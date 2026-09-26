import type { CodingSettings } from '@shared/coding_types';
import { Code2, PanelLeft, PanelRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavigationBarContainer } from '@/components/app/navigationbar/NavigationBarContainer';
import { NavigationBarLeftContainer } from '@/components/app/navigationbar/NavigationBarLeftContainer';
import { WindowControls } from '@/components/app/navigationbar/components/WindowControls';
import { useWindowState } from '@/components/app/navigationbar/hooks/useWindowState';

const isMac = navigator.platform.startsWith('Mac');

interface NavigationProps {
	readonly projectName?: string;
	readonly projectDirectory?: string;
	readonly runtime?: CodingSettings['runtime'];
	readonly onConfiguration: () => void;
	readonly configurationDisabled: boolean;
	readonly sidebar: boolean;
	readonly viewer: boolean;
	readonly onToggleSidebar: () => void;
	readonly onToggleViewer: () => void;
}

export function Navigation({
	projectName,
	projectDirectory,
	runtime,
	sidebar,
	viewer,
	onToggleSidebar,
	onToggleViewer,
	onConfiguration,
	configurationDisabled,
}: NavigationProps) {
	const { isFullScreen, isMaximized } = useWindowState();
	return (
		<NavigationBarContainer>
			<NavigationBarLeftContainer isMac={isMac} isFullScreen={isFullScreen} className="min-w-0">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 shrink-0 rounded-full"
					aria-label="Toggle sessions"
					title="Toggle sessions"
					aria-expanded={sidebar}
					onClick={onToggleSidebar}
				>
					<PanelLeft className="size-4" strokeWidth={1.8} />
				</Button>
				<Code2 className="ml-1 size-4 shrink-0" strokeWidth={1.8} />
				<h1 className="px-1 text-sm font-semibold">Coder</h1>
			</NavigationBarLeftContainer>
			<span
				title={projectDirectory}
				className="min-w-0 flex-1 truncate px-3 text-xs text-muted-foreground"
			>
				{runtime
					? `${runtime === 'pi' ? 'Pi' : runtime === 'codex' ? 'Codex' : 'Claude'}${projectName || projectDirectory ? ' · ' : ''}`
					: ''}
				{projectName ?? projectDirectory}
			</span>
			<div className="z-10 mr-3 flex h-full shrink-0 items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 rounded-full"
					aria-label="Open Coder configuration"
					title="Open Coder configuration"
					disabled={configurationDisabled}
					onClick={onConfiguration}
				>
					<User className="size-4" strokeWidth={1.8} />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 rounded-full"
					aria-label="Toggle content viewer"
					title="Toggle content viewer"
					aria-expanded={viewer}
					onClick={onToggleViewer}
				>
					<PanelRight className="size-4" strokeWidth={1.8} />
				</Button>
			</div>
			{!isMac && <WindowControls isMaximized={isMaximized} />}
		</NavigationBarContainer>
	);
}
