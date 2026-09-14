import {
	Copy,
	FileText,
	FolderOpen,
	LoaderCircle,
	Minus,
	MoreHorizontal,
	Plus,
	PanelRightOpen,
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
import type { CodingController } from '@/controller';

const isMac =
	typeof navigator !== 'undefined' &&
	(navigator.platform === 'MacIntel' || navigator.platform.startsWith('Mac'));

export function Header({
	coding,
	onOpenConfiguration,
	onOpenInstructions,
	onOpenRightSidebar,
	rightSidebarOpen,
	sidebarOpen,
}: {
	coding: CodingController;
	onOpenConfiguration: () => void;
	onOpenInstructions: () => void;
	onOpenRightSidebar: () => void;
	rightSidebarOpen: boolean;
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
			<div className="min-w-0 flex-1" />

			{coding.runState === 'running' ? (
				<span className="mr-3 hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
					<LoaderCircle className="size-3 animate-spin" /> {coding.runLabel}
				</span>
			) : coding.runState === 'error' ? (
				<span className="mr-3 hidden text-[11px] text-destructive sm:block">{coding.runLabel}</span>
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
					aria-label="Open Coder configuration"
					title="Open Coder configuration"
					onClick={onOpenConfiguration}
				>
					<User className="size-4" strokeWidth={1.8} />
				</Button>

				{coding.activeProject ? (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" size="icon-sm" aria-label="Workspace actions">
									<MoreHorizontal />
								</Button>
							}
						/>
						<DropdownMenuContent>
							<DropdownMenuItem onClick={() => void coding.openProject(coding.activeProject!.id)}>
								<FolderOpen /> Open folder
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => void navigator.clipboard.writeText(coding.activeProject!.directory)}
							>
								<Copy /> Copy path
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!coding.activeProject.available}
								onClick={onOpenInstructions}
							>
								<FileText /> Agent instructions
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								disabled={coding.runState === 'running'}
								onClick={() => void coding.removeProject(coding.activeProject!.id)}
							>
								<Trash2 /> Remove workspace
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}

				{!rightSidebarOpen ? (
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Open chat sidebar"
						onClick={onOpenRightSidebar}
					>
						<PanelRightOpen />
					</Button>
				) : null}

				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="New Coder session"
								disabled={!coding.activeProject || coding.runState === 'running'}
								onClick={() => coding.newSession()}
							>
								<Plus />
							</Button>
						}
					/>
					<TooltipContent>New session · ⌘/Ctrl N</TooltipContent>
				</Tooltip>
			</div>

			{!isMac ? (
				<div
					className="flex h-full items-center gap-1"
					style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
				>
					<Button
						type="button"
						variant="ghost"
						className="h-full w-[46px] rounded-none px-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground active:bg-accent"
						onClick={() => inKucedr && win.minimize()}
						title="Minimize"
						aria-label="Minimize"
					>
						<Minus className="h-[13px] w-[13px]" strokeWidth={1.5} />
					</Button>
					<Button
						type="button"
						variant="ghost"
						className="h-full w-[46px] rounded-none px-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground active:bg-accent"
						onClick={() => inKucedr && win.maximize()}
						title={isMaximized ? 'Restore' : 'Maximize'}
						aria-label={isMaximized ? 'Restore' : 'Maximize'}
					>
						{isMaximized ? (
							<Copy className="h-[11px] w-[11px]" strokeWidth={1.5} />
						) : (
							<Square className="h-[11px] w-[11px]" strokeWidth={1.5} />
						)}
					</Button>
					<Button
						type="button"
						variant="ghost"
						className="h-full w-[46px] rounded-none px-0 text-muted-foreground hover:bg-[#e81123] hover:text-white active:bg-[#c42b1c] active:text-white"
						onClick={() => inKucedr && win.close()}
						title="Close"
						aria-label="Close"
					>
						<X className="h-[13px] w-[13px]" strokeWidth={1.5} />
					</Button>
				</div>
			) : null}
		</header>
	);
}
