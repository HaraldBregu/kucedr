import { useEffect, useRef, useState } from 'react';
import { ArrowDown, FolderOpen, TriangleAlert } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Blocks } from '@/components/blocks';
import { Composer } from '@/components/composer';
import type { CodingController } from '@/controller';

export function Workspace({ coder }: { coder: CodingController }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [atBottom, setAtBottom] = useState(true);

	useEffect(() => {
		const scroll = scrollRef.current;
		if (scroll && atBottom) scroll.scrollTop = scroll.scrollHeight;
	}, [atBottom, coder.blocks, coder.runLabel]);

	const scrollToLatest = () => {
		const scroll = scrollRef.current;
		if (!scroll) return;
		scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' });
		setAtBottom(true);
	};

	return (
		<div className="relative flex min-h-0 flex-1 flex-col bg-background">
			<div
				ref={scrollRef}
				className="min-h-0 flex-1 overflow-y-auto"
				onScroll={(event) => {
					const target = event.currentTarget;
					setAtBottom(target.scrollHeight - target.scrollTop - target.clientHeight < 72);
				}}
			>
				{coder.loading ? (
					<div className="mx-auto max-w-4xl space-y-3 p-6">
						<Skeleton className="h-4 w-1/3" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-4/5" />
					</div>
				) : !coder.activeProject ? (
					<Empty>
						<FolderOpen className="size-5 text-muted-foreground" />
						<div>
							<h1 className="text-sm font-medium">Open a project</h1>
							<p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
								Choose a folder to start coding.
							</p>
						</div>
						<Button onClick={() => void coder.addProject()} disabled={coder.busy}>
							<FolderOpen /> Choose folder
						</Button>
					</Empty>
				) : !coder.activeProject.available ? (
					<Empty>
						<TriangleAlert className="size-7 text-destructive" />
						<div>
							<h1 className="text-sm font-medium">Project folder unavailable</h1>
							<p className="mt-1 max-w-md break-all text-xs text-muted-foreground">
								{coder.activeProject.directory}
							</p>
						</div>
						<Button
							variant="outline"
							onClick={() => void coder.removeProject(coder.activeProject!.id)}
						>
							Remove from Coding
						</Button>
					</Empty>
				) : coder.blocks.length === 0 ? (
					<Empty>
						<p className="text-xs text-muted-foreground">
							Start with a prompt or switch to Command.
						</p>
					</Empty>
				) : (
					<Blocks coder={coder} />
				)}

				{coder.error ? (
					<div className="p-4 sm:px-6">
						<Alert className="border-destructive/30 bg-destructive/5 text-destructive">
							{coder.error}
						</Alert>
					</div>
				) : null}
			</div>

			{!atBottom && coder.blocks.length > 0 ? (
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								variant="secondary"
								size="icon-sm"
								className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2"
								aria-label="Jump to latest"
								onClick={scrollToLatest}
							>
								<ArrowDown />
							</Button>
						}
					/>
					<TooltipContent>Jump to latest</TooltipContent>
				</Tooltip>
			) : null}

			<div className="sr-only" aria-live="polite">
				{coder.runLabel}
			</div>
			<Composer coder={coder} />
		</div>
	);
}
