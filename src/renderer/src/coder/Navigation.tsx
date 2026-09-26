import { useEffect, useRef, useState } from 'react';
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
	const [progress, setProgress] = useState(0);
	const animation = useRef<number | null>(null);
	useEffect(
		() => () => {
			if (animation.current !== null) cancelAnimationFrame(animation.current);
		},
		[]
	);
	const run = () => {
		if (animation.current !== null) cancelAnimationFrame(animation.current);
		setProgress(0);
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			setProgress(100);
		} else {
			const started = performance.now();
			const frame = (now: number) => {
				const next = Math.min(100, Math.round(((now - started) / 5000) * 100));
				setProgress(next);
				animation.current = next < 100 ? requestAnimationFrame(frame) : null;
			};
			animation.current = requestAnimationFrame(frame);
		}
		onRun();
	};
	return (
		<NavigationBarContainer>
			<NavigationBarLeftContainer
				isMac={isMac}
				isFullScreen={isFullScreen}
				className={isMac && !isFullScreen ? 'ml-24 min-w-0' : 'min-w-0'}
			>
				<Button
					type="button"
					variant="secondary"
					size="icon"
					className="size-8 shrink-0"
					aria-label="Run current prompt"
					title="Run current prompt"
					disabled={!canRun}
					onClick={run}
				>
					<Play className="size-4" />
				</Button>
				<Button
					type="button"
					variant="secondary"
					size="icon"
					className="size-8 shrink-0"
					aria-label="Stop current run"
					title="Stop current run"
					disabled
				>
					<Square className="size-4" />
				</Button>
				<span className="min-w-0 truncate px-2 text-sm font-medium" title={workspaceName}>
					{workspaceName}
				</span>
				<div
					role="progressbar"
					aria-label="Play animation progress"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={progress}
					className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-secondary"
				>
					<div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
				</div>
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
