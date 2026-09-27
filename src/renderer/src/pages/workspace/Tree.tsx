import { ChevronRight, File, Folder } from 'lucide-react';
import type { WorkspaceTreeEntry } from '@shared/agent_types';

interface WorkspaceTreeProps {
	readonly entries: WorkspaceTreeEntry[];
	readonly onFileSelect: (file: WorkspaceTreeEntry) => void;
	readonly selectedPath: string | null;
}

export function WorkspaceTree({ entries, onFileSelect, selectedPath }: WorkspaceTreeProps): React.JSX.Element {
	return (
		<ul className="flex min-w-0 flex-col gap-1">
			{entries.map((entry) => (
				<li key={entry.path} className="min-w-0">
					{entry.type === 'directory' ? (
						<details className="group">
							<summary className="flex min-h-8 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
								<ChevronRight className="size-3 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" strokeWidth={1.8} />
								<Folder className="size-4 shrink-0" strokeWidth={1.8} />
								<span className="truncate" title={entry.path}>{entry.name}</span>
							</summary>
							{entry.children?.length ? (
								<div className="ml-3 border-l border-sidebar-border pl-1">
									<WorkspaceTree entries={entry.children} onFileSelect={onFileSelect} selectedPath={selectedPath} />
								</div>
							) : null}
						</details>
					) : (
						<button
							type="button"
							aria-current={selectedPath === entry.path ? 'page' : undefined}
							className="flex min-h-8 w-full items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium"
							title={entry.path}
							onClick={() => onFileSelect(entry)}
						>
							<File className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
							<span className="truncate">{entry.name}</span>
						</button>
					)}
				</li>
			))}
		</ul>
	);
}
