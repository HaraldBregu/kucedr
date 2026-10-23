import { useState } from 'react';
import { ChevronRight, File, FileImage, FileMusic, FileText, FileVideo, Folder } from 'lucide-react';
import { workspaceFileType } from '@shared/workspace';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { WorkspaceRenameInput } from './RenameInput';

interface WorkspaceTreeProps {
	readonly entries: WorkspaceTreeEntry[];
	readonly onFileSelect: (file: WorkspaceTreeEntry) => void;
	readonly onEntryContextMenu: (entry: WorkspaceTreeEntry) => void;
	readonly renamingPath: string | null;
	readonly renameBusy: boolean;
	readonly onRename: (name: string) => void;
	readonly onRenameCancel: () => void;
	readonly selectedPath: string | null;
	readonly onMove: (sourcePath: string, destinationPath: string) => void;
}

const fileIcons = { image: FileImage, audio: FileMusic, video: FileVideo, markdown: FileText, text: FileText } as Partial<Record<string, typeof File>>;

export function WorkspaceTree({ entries, onFileSelect, onEntryContextMenu, renamingPath, renameBusy, onRename, onRenameCancel, selectedPath, onMove }: WorkspaceTreeProps): React.JSX.Element {
	const [openDirectories, setOpenDirectories] = useState(() => new Set(entries.filter((entry) => selectedPath && (selectedPath.startsWith(`${entry.path}/`) || selectedPath.startsWith(`${entry.path}\\`))).map((entry) => entry.path)));
	return (
		<ul className="flex min-w-0 flex-col gap-1">
			{entries.map((entry) => (
				<li key={entry.path} className="min-w-0">
					{renamingPath === entry.path ? (
						<div className="flex min-h-8 items-center gap-2 rounded-md px-2 text-sm">
							{entry.type === 'directory' ? <Folder className="size-4 shrink-0" strokeWidth={1.8} /> : <File className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />}
							<WorkspaceRenameInput name={entry.name} busy={renameBusy} onCancel={onRenameCancel} onConfirm={onRename} />
						</div>
					) : entry.type === 'directory' ? (
						<details className="group" open={openDirectories.has(entry.path)} onToggle={(event) => {
							if (event.target !== event.currentTarget) return;
							const open = event.currentTarget.open;
							setOpenDirectories((current) => {
								if (current.has(entry.path) === open) return current;
								const next = new Set(current);
								if (open) next.add(entry.path);
								else next.delete(entry.path);
								return next;
							});
						}}>
						<summary draggable className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[drop-target]:bg-sidebar-accent data-[drop-target]:ring-2 data-[drop-target]:ring-sidebar-ring" onDragStart={(event) => {
							event.stopPropagation();
							event.dataTransfer.setData('application/x-workspace-path', entry.path);
						}} onDragOver={(event) => {
							if (!event.dataTransfer.types.includes('application/x-workspace-path')) return;
							event.preventDefault();
							event.stopPropagation();
							event.currentTarget.dataset.dropTarget = '';
						}} onDragLeave={(event) => {
							delete event.currentTarget.dataset.dropTarget;
						}} onDrop={(event) => {
							delete event.currentTarget.dataset.dropTarget;
							const source = event.dataTransfer.getData('application/x-workspace-path');
							if (!source) return;
							event.preventDefault();
							event.stopPropagation();
							onMove(source, entry.path);
						}} onContextMenu={(event) => {
							event.preventDefault();
							event.stopPropagation();
							onEntryContextMenu(entry);
						}}>
								<ChevronRight className="size-3 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" strokeWidth={1.8} />
								<Folder className="size-4 shrink-0" strokeWidth={1.8} />
								<span className="truncate" title={entry.path}>{entry.name}</span>
							</summary>
							{entry.children?.length ? (
								<div className="ml-3 border-l border-sidebar-border pl-1">
									<WorkspaceTree entries={entry.children} onFileSelect={onFileSelect} onEntryContextMenu={onEntryContextMenu} renamingPath={renamingPath} renameBusy={renameBusy} onRename={onRename} onRenameCancel={onRenameCancel} selectedPath={selectedPath} onMove={onMove} />
								</div>
							) : null}
						</details>
					) : (
						<button
							type="button"
							aria-current={selectedPath === entry.path ? 'page' : undefined}
							className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium"
							title={entry.path}
							draggable
							onDragStart={(event) => event.dataTransfer.setData('application/x-workspace-path', entry.path)}
							onClick={() => onFileSelect(entry)}
							onContextMenu={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onEntryContextMenu(entry);
							}}
						>
							{(() => {
								const Icon = fileIcons[workspaceFileType(entry.path).kind] ?? File;
								return <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />;
							})()}
							<span className="truncate">{entry.name}</span>
						</button>
					)}
				</li>
			))}
		</ul>
	);
}
