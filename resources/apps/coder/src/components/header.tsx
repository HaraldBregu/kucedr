import {
	Copy,
	FileText,
	FolderOpen,
	LoaderCircle,
	Minus,
	MoreHorizontal,
	Plus,
	Search,
	Square,
	Trash2,
	User,
	X,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { isKucedr, win } from '@kucedr/sdk';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { CoderController } from '@/controller';

const isMac =
	typeof navigator !== 'undefined' &&
	(navigator.platform === 'MacIntel' || navigator.platform.startsWith('Mac'));

export function Header({
	coder,
	onOpenConfiguration,
	onOpenInstructions,
	sidebarOpen,
}: {
	coder: CoderController;
	onOpenConfiguration: () => void;
	onOpenInstructions: () => void;
	sidebarOpen: boolean;
}): React.JSX.Element {
	const inKucedr = isKucedr();
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		if (!inKucedr || isMac) return;
		void win.isMaximized().then(setIsMaximized);
		return win.onMaximizeChange(setIsMaximized);
	}, [inKucedr]);

	return (
		<header
			className={`flex h-12 shrink-0 items-center border-b border-border bg-card pl-3 ${!sidebarOpen ? 'pl-28' : ''}`}
			style={{ WebkitAppRegion: 'drag' } as CSSProperties}
		>
			<SidebarTrigger style={{ WebkitAppRegion: 'no-drag' } as CSSProperties} />
			<h1 className="min-w-0 shrink truncate text-sm font-medium">Coder</h1>
			<div className="min-w-0 flex-1" />

			{coder.runState === 'running' ? (
				<span className="mr-3 hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
					<LoaderCircle className="size-3 animate-spin" /> {coder.runLabel}
				</span>
			) : coder.runState === 'error' ? (
				<span className="mr-3 hidden text-[11px] text-destructive sm:block">{coder.runLabel}</span>
			) : null}
			<div
				className="z-10 mr-3 flex h-full items-center gap-1"
				style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
			>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="rounded-full text-muted-foreground hover:text-foreground"
					aria-label="Search Coder workspaces"
					title="Search Coder workspaces"
					onClick={() => document.getElementById('coder-sidebar-search')?.focus()}
				>
					<Search className="size-4" strokeWidth={1.8} />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="rounded-full text-muted-foreground hover:text-foreground"
					aria-label="Open Coder configuration"
					title="Open Coder configuration"
					onClick={onOpenConfiguration}
				>
					<User className="size-4" strokeWidth={1.8} />
				</Button>

			{coder.activeProject ? (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="ghost"
								size="icon-sm"
								className="[webkit-app-region:no-drag]"
								aria-label="Workspace actions"
							>
								<MoreHorizontal />
							</Button>
						}
					/>
					<DropdownMenuContent>
						<DropdownMenuItem onClick={() => void coder.openProject(coder.activeProject!.id)}>
							<FolderOpen /> Open folder
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => void navigator.clipboard.writeText(coder.activeProject!.directory)}
						>
							<Copy /> Copy path
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={!coder.activeProject.available}
							onClick={onOpenInstructions}
						>
							<FileText /> Agent instructions
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							disabled={coder.runState === 'running'}
							onClick={() => void coder.removeProject(coder.activeProject!.id)}
						>
							<Trash2 /> Remove workspace
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}

			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							variant="ghost"
							size="icon-sm"
							className="[webkit-app-region:no-drag]"
							aria-label="New coding session"
							disabled={!coder.activeProject || coder.runState === 'running'}
							onClick={() => coder.newSession()}
						>
							<Plus />
						</Button>
					}
				/>
				<TooltipContent>New session · ⌘/Ctrl N</TooltipContent>
			</Tooltip>

			{!isMac ? (
				<div
					className="-mr-3 ml-1 flex h-full items-center"
					style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
				>
					<button
						type="button"
						className="flex h-full w-[46px] items-center justify-center text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground active:bg-accent"
						onClick={() => inKucedr && win.minimize()}
						title="Minimize"
						aria-label="Minimize"
					>
						<Minus className="size-[13px]" strokeWidth={1.5} />
					</button>
					<button
						type="button"
						className="flex h-full w-[46px] items-center justify-center text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground active:bg-accent"
						onClick={() => inKucedr && win.maximize()}
						title={isMaximized ? 'Restore' : 'Maximize'}
						aria-label={isMaximized ? 'Restore' : 'Maximize'}
					>
						{isMaximized ? (
							<Copy className="size-[11px]" strokeWidth={1.5} />
						) : (
							<Square className="size-[11px]" strokeWidth={1.5} />
						)}
					</button>
					<button
						type="button"
						className="flex h-full w-[46px] items-center justify-center text-muted-foreground transition-colors hover:bg-[#e81123] hover:text-white active:bg-[#c42b1c] active:text-white"
						onClick={() => inKucedr && win.close()}
						title="Close"
						aria-label="Close"
					>
						<X className="size-[13px]" strokeWidth={1.5} />
					</button>
				</div>
			) : null}
		</header>
	);
}
