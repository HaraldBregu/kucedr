import type { CSSProperties } from 'react';
import { FileText, Plus } from 'lucide-react';
import { SPLIT_ITEM_ACTIVE_CLASS, SPLIT_ITEM_CLASS } from '@/components/app/base/page';
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from '@/components/app/base/page/context/state';
import { cn } from '@/lib/utils';
import { Resize } from './Resize';
import type { Workspace } from './workspace';

export function Sidebar({
	coding,
	width,
	onWidthChange,
	markdownFiles,
	markdownError,
	activeMarkdown,
	onMarkdown,
	onCreateMarkdown,
}: {
	coding: Workspace;
	width: number;
	onWidthChange: (width: number) => void;
	markdownFiles: string[];
	markdownError: string;
	activeMarkdown: string | null;
	onMarkdown: (filePath: string) => void;
	onCreateMarkdown: () => void;
}) {
	const project = coding.projects.find((item) => item.id === coding.projectId);

	return (
		<aside
			aria-label="Workspace instructions"
			data-slot="coder-sidebar"
			className="absolute inset-y-0 left-0 z-20 flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-background text-sidebar-foreground md:relative md:w-[var(--coder-sidebar-width)]"
			style={{ '--coder-sidebar-width': `${width}px` } as CSSProperties}
		>
			<header className="flex h-12 shrink-0 items-center justify-between border-b border-sidebar-border/50 px-4">
				<h2 className="text-xs font-medium text-sidebar-foreground/70">Workspace instructions</h2>
				<button
					type="button"
					aria-label="New Markdown file"
					title="New Markdown file"
					disabled={!project?.available}
					className="rounded p-1 hover:bg-sidebar-accent disabled:opacity-50"
					onClick={onCreateMarkdown}
				>
					<Plus className="size-4" />
				</button>
			</header>
			<nav
				aria-label="Workspace instruction files"
				className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2 pt-3"
			>
				<ul className="flex min-w-0 flex-col gap-1">
					{markdownFiles.map((filePath) => (
						<li key={filePath}>
							<button
								type="button"
								title={filePath}
								aria-current={activeMarkdown === filePath ? 'page' : undefined}
								className={cn(
									SPLIT_ITEM_CLASS,
									'w-full min-w-0 gap-2',
									activeMarkdown === filePath && SPLIT_ITEM_ACTIVE_CLASS
								)}
								onClick={() => onMarkdown(filePath)}
							>
								<FileText className="size-4 shrink-0" />
								<span className="truncate">{filePath}</span>
							</button>
						</li>
					))}
				</ul>
				{project?.available && !markdownFiles.length && (
					<p className="px-2 py-1 text-xs text-muted-foreground">No Markdown files yet.</p>
				)}
				{!coding.loading && !project && (
					<p className="px-2 py-1 text-xs text-muted-foreground">Choose a project in Sessions.</p>
				)}
				{markdownError && (
					<p role="alert" className="px-2 py-1 text-xs text-destructive">
						{markdownError}
					</p>
				)}
			</nav>
			<Resize
				side="right"
				width={width}
				minWidth={MIN_SIDEBAR_WIDTH}
				maxWidth={MAX_SIDEBAR_WIDTH}
				label="Resize instructions sidebar"
				className="md:block"
				onWidthChange={onWidthChange}
			/>
		</aside>
	);
}
