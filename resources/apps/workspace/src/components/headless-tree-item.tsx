import type { ItemInstance } from '@headless-tree/core';
import type { WorkspaceTreeEntry } from '@kucedr/sdk';
import { FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react';
import { useEffect, useRef, type DragEvent } from 'react';

import { TreeItem, TreeItemLabel } from '@/components/ui/tree';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { showNativeContextMenu } from '@/lib/menu';

export interface HeadlessTreeItemProps {
	draggedPath: string | null;
	dropError: string;
	dropTargetPath: string | null;
	entry: WorkspaceTreeEntry;
	item: ItemInstance<WorkspaceTreeEntry>;
	movingPath: string | null;
	onArchiveRequest: (entry: WorkspaceTreeEntry, action: 'compress' | 'extract') => void;
	onCreateDirectory: (parentPath: string) => void;
	onCreateFile: (parentPath: string) => void;
	onDeleteRequest: (entry: WorkspaceTreeEntry) => void;
	onDragEnd: () => void;
	onDragLeave: (event: DragEvent<HTMLElement>, path: string) => void;
	onDragOver: (event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) => void;
	onDragStart: (event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) => void;
	onDrop: (event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) => void;
	onDuplicateRequest: (entry: WorkspaceTreeEntry) => void;
	onRenameCancel: () => void;
	onRenameCommit: () => void;
	onRenameNameChange: (name: string) => void;
	onRenameRequest: (entry: WorkspaceTreeEntry) => void;
	onSelect: (entry: WorkspaceTreeEntry) => void;
	renameError: string;
	renameName: string;
	renameTarget: WorkspaceTreeEntry | null;
	renaming: boolean;
	selected: boolean;
}

export function HeadlessTreeItem({
	draggedPath,
	dropError,
	dropTargetPath,
	entry,
	item,
	movingPath,
	onArchiveRequest,
	onCreateDirectory,
	onCreateFile,
	onDeleteRequest,
	onDragEnd,
	onDragLeave,
	onDragOver,
	onDragStart,
	onDrop,
	onDuplicateRequest,
	onRenameCancel,
	onRenameCommit,
	onRenameNameChange,
	onRenameRequest,
	onSelect,
	renameError,
	renameName,
	renameTarget,
	renaming,
	selected,
}: HeadlessTreeItemProps) {
	const isDirectory = entry.type === 'directory';
	const isDropTarget = dropTargetPath === entry.path;
	const editing = renameTarget?.path === entry.path;
	const renameInputRef = useRef<HTMLInputElement>(null);
	const cancelBlurRef = useRef(false);
	useEffect(() => {
		if (editing && renameError) renameInputRef.current?.focus();
	}, [editing, renameError]);

	return (
		<TreeItem
			item={item}
			data-workspace-entry
			draggable={!movingPath && !editing}
			title={entry.path}
			onDragStartCapture={(event) => onDragStart(event, entry)}
			onDragEndCapture={onDragEnd}
			onDragOver={(event) => onDragOver(event, entry)}
			onDragLeave={(event) => onDragLeave(event, entry.path)}
			onDrop={(event) => onDrop(event, entry)}
			onContextMenu={(event) => {
				showNativeContextMenu(
					event,
					[
						{ id: isDirectory ? 'toggle' : 'open', label: isDirectory ? (item.isExpanded() ? 'Collapse' : 'Expand') : 'Open', enabled: !isDirectory || Boolean(entry.children?.length) },
						{ type: 'separator' },
						{ id: 'new-file', label: 'New File' },
						...(isDirectory ? ([{ id: 'new-folder', label: 'New Folder' }] as const) : []),
						{ type: 'separator' },
						{ id: 'rename', label: isDirectory ? 'Rename Folder' : 'Rename File' },
						...(isDirectory ? [] : ([{ id: 'duplicate', label: 'Duplicate' }] as const)),
						{ type: 'separator' },
						{ id: entry.name.toLowerCase().endsWith('.zip') ? 'extract' : 'compress', label: entry.name.toLowerCase().endsWith('.zip') ? 'Extract Here' : 'Compress to ZIP' },
						{ type: 'separator' },
						{ id: 'copy-path', label: 'Copy Path' },
						{ type: 'separator' },
						{ id: 'delete', label: isDirectory ? 'Delete Folder' : 'Delete File' },
					],
					{
						toggle: () => (item.isExpanded() ? item.collapse() : item.expand()),
						open: () => onSelect(entry),
						'new-file': () => onCreateFile(isDirectory ? entry.path : entry.path.split('/').slice(0, -1).join('/')),
						'new-folder': () => onCreateDirectory(entry.path),
						rename: () => onRenameRequest(entry),
						duplicate: () => onDuplicateRequest(entry),
						compress: () => onArchiveRequest(entry, 'compress'),
						extract: () => onArchiveRequest(entry, 'extract'),
						'copy-path': () => navigator.clipboard.writeText(entry.path),
						delete: () => onDeleteRequest(entry),
					}
				);
			}}
			className={cn(draggedPath === entry.path && 'opacity-45', movingPath === entry.path && 'animate-pulse')}
		>
			<TreeItemLabel
				aria-busy={movingPath === entry.path || undefined}
				aria-current={selected ? 'page' : undefined}
				aria-describedby="workspace-drag-instructions"
				aria-keyshortcuts="Backspace Delete"
				className={cn(
					selected && 'bg-sidebar-accent text-sidebar-foreground',
					isDropTarget && !dropError && 'bg-sidebar-accent text-sidebar-foreground ring-1 ring-sidebar-ring',
					isDropTarget && dropError && 'ring-1 ring-destructive'
				)}
				onDoubleClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					if (!editing) onRenameRequest(entry);
				}}
				onClick={() => {
					if (!isDirectory) onSelect(entry);
				}}
				onKeyDown={(event) => {
					if (event.key === 'Backspace' || event.key === 'Delete') {
						event.preventDefault();
						onDeleteRequest(entry);
					}
				}}
			>
				<span className="-order-1 flex min-w-0 flex-1 items-center gap-1.5">
					{isDirectory ? item.isExpanded() ? <FolderOpenIcon className="size-3.5 shrink-0 text-sidebar-muted" /> : <FolderIcon className="size-3.5 shrink-0 text-sidebar-muted" /> : <FileIcon className="size-3.5 shrink-0 text-sidebar-muted" />}
					{editing ? (
						<Input ref={renameInputRef} autoFocus aria-invalid={Boolean(renameError)} value={renameName} disabled={renaming} className="h-5 min-w-0 flex-1 rounded-sm px-1.5 text-[12px] shadow-none" onBlur={() => { if (cancelBlurRef.current) { cancelBlurRef.current = false; return; } onRenameCommit(); }} onChange={(event) => onRenameNameChange(event.target.value)} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onFocus={(event) => { const extensionStart = renameName.lastIndexOf('.'); event.currentTarget.setSelectionRange(0, entry.type === 'file' && extensionStart > 0 ? extensionStart : renameName.length); }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { event.preventDefault(); cancelBlurRef.current = true; onRenameCancel(); } }} onPointerDown={(event) => event.stopPropagation()} />
					) : <span className="truncate">{entry.name}</span>}
				</span>
			</TreeItemLabel>
			{editing && renameError ? <p role="alert" className="px-6 py-1 text-[10px] leading-4 text-destructive">{renameError}</p> : null}
		</TreeItem>
	);
}
