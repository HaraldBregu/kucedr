import { useState, type KeyboardEvent } from 'react';
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react';
import type { WorkspaceTreeEntry } from '@shared/agent_types';

interface WorkspaceBreadcrumbTreeProps {
	readonly entries: WorkspaceTreeEntry[];
	readonly onFileSelect: (file: WorkspaceTreeEntry) => void;
	readonly selectedPath: string;
	readonly level?: number;
}

export function WorkspaceBreadcrumbTree({ entries, onFileSelect, selectedPath, level = 0 }: WorkspaceBreadcrumbTreeProps): React.JSX.Element {
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const onKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
		if (level !== 0) return;
		const current = (event.target as HTMLElement).closest<HTMLButtonElement>('[role="treeitem"]');
		if (!current) return;
		const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="treeitem"]'));
		const index = items.indexOf(current);
		let next: HTMLButtonElement | null | undefined;
		if (event.key === 'ArrowDown') next = items[index + 1];
		else if (event.key === 'ArrowUp') next = items[index - 1];
		else if (event.key === 'Home') next = items[0];
		else if (event.key === 'End') next = items.at(-1);
		else if (event.key === 'ArrowRight' && current.getAttribute('aria-expanded') === 'false') current.click();
		else if (event.key === 'ArrowRight' && current.getAttribute('aria-expanded') === 'true') next = items[index + 1];
		else if (event.key === 'ArrowLeft' && current.getAttribute('aria-expanded') === 'true') current.click();
		else if (event.key === 'ArrowLeft') next = current.closest('ul[role="group"]')?.parentElement?.querySelector<HTMLButtonElement>(':scope > button[role="treeitem"]');
		else return;
		event.preventDefault();
		event.stopPropagation();
		next?.focus();
	};
	return (
		<ul role={level === 0 ? 'tree' : 'group'} aria-label={level === 0 ? 'Workspace files' : undefined} className={level === 0 ? 'space-y-0.5 p-1' : 'space-y-0.5'} onKeyDown={level === 0 ? onKeyDown : undefined}>
			{entries.map((entry) => {
				const directory = entry.type === 'directory';
				const open = expanded.has(entry.path);
				return (
					<li key={entry.path} role="none">
						<button
							type="button"
							role="treeitem"
							aria-level={level + 1}
							aria-expanded={directory ? open : undefined}
							aria-selected={!directory ? selectedPath === entry.path : undefined}
							title={entry.path}
							className="flex h-7 w-full items-center gap-1.5 rounded-md pr-1.5 text-left text-xs font-medium text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring aria-selected:bg-accent aria-selected:text-foreground"
							style={{ paddingInlineStart: 6 + level * 14 }}
							onClick={() => {
								if (!directory) { onFileSelect(entry); return; }
								setExpanded((current) => {
									const next = new Set(current);
									if (next.has(entry.path)) next.delete(entry.path);
									else next.add(entry.path);
									return next;
								});
							}}
						>
							{directory ? <ChevronRight aria-hidden="true" className={`size-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} /> : <span className="size-3 shrink-0" />}
							{directory ? open ? <FolderOpen aria-hidden="true" className="size-3.5 shrink-0" /> : <Folder aria-hidden="true" className="size-3.5 shrink-0" /> : <File aria-hidden="true" className="size-3.5 shrink-0" />}
							<span className="min-w-0 truncate">{entry.name}</span>
						</button>
						{directory && open && entry.children?.length ? <WorkspaceBreadcrumbTree entries={entry.children} onFileSelect={onFileSelect} selectedPath={selectedPath} level={level + 1} /> : null}
					</li>
				);
			})}
		</ul>
	);
}
