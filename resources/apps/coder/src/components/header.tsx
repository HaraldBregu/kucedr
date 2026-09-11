import {
	Copy,
	FileText,
	FolderOpen,
	LoaderCircle,
	Minus,
	MoreHorizontal,
	Plus,
	Square,
	Trash2,
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
	onOpenInstructions,
}: {
	coder: CoderController;
	onOpenInstructions: () => void;
}): React.JSX.Element {
	const session = coder.sessions.find((item) => item.id === coder.activeSessionId);
	const inKucedr = isKucedr();
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		if (!inKucedr || isMac) return;
		void win.isMaximized().then(setIsMaximized);
		return win.onMaximizeChange(setIsMaximized);
	}, [inKucedr]);

	return (
		<header
			className={`flex h-12 shrink-0 items-center gap-2 bg-transparent ${isMac ? 'pl-[76px] pr-3' : 'px-3'}`}
			style={{ WebkitAppRegion: 'drag' } as CSSProperties}
		>
			<SidebarTrigger className="[webkit-app-region:no-drag]" />
			<div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
				<span className="truncate font-medium">{coder.activeProject?.name ?? 'Coder'}</span>
				<span className="text-muted-foreground">/</span>
				<span className="truncate text-muted-foreground">{session?.title ?? 'New session'}</span>
			</div>

			{coder.runState === 'running' ? (
				<span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
					<LoaderCircle className="size-3 animate-spin" /> {coder.runLabel}
				</span>
			) : coder.runState === 'error' ? (
				<span className="hidden text-[11px] text-destructive sm:block">{coder.runLabel}</span>
			) : null}

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
