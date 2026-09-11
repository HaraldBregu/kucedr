import {
	Copy,
	FileText,
	FolderOpen,
	LoaderCircle,
	MoreHorizontal,
	Plus,
	Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CoderController } from '@/controller';

export function Header({
	coder,
	onOpenInstructions,
}: {
	coder: CoderController;
	onOpenInstructions: () => void;
}) {
	const session = coder.sessions.find((item) => item.id === coder.activeSessionId);
	return (
		<header className="flex h-11 shrink-0 items-center gap-2 bg-background px-3">
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
							<Button variant="ghost" size="icon-sm" aria-label="Workspace actions">
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
		</header>
	);
}
