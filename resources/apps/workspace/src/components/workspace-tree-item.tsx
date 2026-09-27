import type { WorkspaceTreeEntry } from '@kucedr/sdk';
import { useEffect, useRef, type DragEvent } from 'react';

import {
	TreeIcon,
	TreeLabel,
	TreeNode,
	TreeNodeContent,
	TreeNodeTrigger,
} from '@/components/kibo-ui/tree';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { showNativeContextMenu } from '@/lib/menu';

export interface WorkspaceTreeItemProps {
	depth: number;
	draggedPath: string | null;
	dropError: string;
	dropTargetPath: string | null;
	entry: WorkspaceTreeEntry;
	expanded: Set<string>;
	isLast?: boolean;
	movingPath: string | null;
	onCreateDirectory: (parentPath: string) => void;
	onCreateFile: (parentPath: string) => void;
	onDeleteRequest: (entry: WorkspaceTreeEntry) => void;
	onDuplicateRequest: (entry: WorkspaceTreeEntry) => void;
	onArchiveRequest: (entry: WorkspaceTreeEntry, action: 'compress' | 'extract') => void;
	onRenameCancel: () => void;
	onRenameCommit: () => void;
	onRenameNameChange: (name: string) => void;
	onRenameRequest: (entry: WorkspaceTreeEntry) => void;
	onDragEnd: () => void;
	onDragLeave: (event: DragEvent<HTMLElement>, path: string) => void;
	onDragOver: (event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) => void;
	onDragStart: (event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) => void;
	onDrop: (event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) => void;
	onSelect: (entry: WorkspaceTreeEntry) => void;
	onToggle: (path: string) => void;
	selectedPath: string | null;
	renameError: string;
	renameName: string;
	renameTarget: WorkspaceTreeEntry | null;
	renaming: boolean;
}

export function WorkspaceTreeItem({
	depth,
	draggedPath,
	dropError,
	dropTargetPath,
	entry,
	expanded,
	isLast = false,
	movingPath,
	onCreateDirectory,
	onCreateFile,
	onDeleteRequest,
	onDuplicateRequest,
	onArchiveRequest,
	onRenameCancel,
	onRenameCommit,
	onRenameNameChange,
	onRenameRequest,
	onDragEnd,
	onDragLeave,
	onDragOver,
	onDragStart,
	onDrop,
	onSelect,
	onToggle,
	selectedPath,
	renameError,
	renameName,
	renameTarget,
	renaming,
}: WorkspaceTreeItemProps) {
	const isDirectory = entry.type === 'directory';
	const isExpanded = expanded.has(entry.path);
	const selected = selectedPath === entry.path;
	const isDropTarget = dropTargetPath === entry.path;
	const createParentPath = isDirectory ? entry.path : entry.path.split('/').slice(0, -1).join('/');
	const isZipFile = entry.type === 'file' && entry.name.toLowerCase().endsWith('.zip');
	const editing = renameTarget?.path === entry.path;
	const renameInputRef = useRef<HTMLInputElement>(null);
	const cancelBlurRef = useRef(false);
	useEffect(() => {
		if (!editing || !renameError) return;
		renameInputRef.current?.focus();
	}, [editing, renameError]);

	return (
		<TreeNode isLast={isLast} level={depth} nodeId={entry.path}>
			<TreeNodeTrigger
				data-workspace-entry
				draggable={!movingPath && !editing}
				expandOnClick={isDirectory}
				role="treeitem"
				tabIndex={0}
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
							{
								id: isDirectory ? 'toggle' : 'open',
								label: isDirectory ? (isExpanded ? 'Collapse' : 'Expand') : 'Open',
								enabled: !isDirectory || Boolean(entry.children?.length),
							},
							{ type: 'separator' },
							{ id: 'new-file', label: 'New File' },
							...(isDirectory
								? ([
										{ id: 'new-folder', label: 'New Folder' },
									] as const)
								: []),
							{ type: 'separator' },
							{ id: 'rename', label: isDirectory ? 'Rename Folder' : 'Rename File' },
							...(isDirectory ? [] : ([{ id: 'duplicate', label: 'Duplicate' }] as const)),
							{ type: 'separator' },
							{
								id: isZipFile ? 'extract' : 'compress',
								label: isZipFile ? 'Extract Here' : 'Compress to ZIP',
							},
							{ type: 'separator' },
							{ id: 'copy-path', label: 'Copy Path' },
							{ type: 'separator' },
							{
								id: 'delete',
								label: isDirectory ? 'Delete Folder' : 'Delete File',
							},
						],
						{
							toggle: () => onToggle(entry.path),
							open: () => onSelect(entry),
							'new-file': () => onCreateFile(createParentPath),
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
				onDoubleClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					if (!editing) onRenameRequest(entry);
				}}
				onClick={() => {
					if (!isDirectory) onSelect(entry);
				}}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						if (isDirectory) onToggle(entry.path);
						else onSelect(entry);
					}
					if (event.key === 'Backspace' || event.key === 'Delete') {
						event.preventDefault();
						onDeleteRequest(entry);
					}
				}}
				aria-expanded={isDirectory ? isExpanded : undefined}
				aria-current={selected ? 'page' : undefined}
				aria-describedby="workspace-drag-instructions"
				aria-keyshortcuts="Backspace Delete"
				aria-busy={movingPath === entry.path || undefined}
				className={cn(
					'mx-0 h-7 gap-1.5 rounded-md px-0 py-0 pr-1 text-left text-[12px] font-medium text-sidebar-muted outline-none',
					'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-1 focus-visible:ring-sidebar-ring',
					'data-[selected=true]:bg-sidebar-accent data-[selected=true]:text-sidebar-foreground',
					draggedPath === entry.path && 'opacity-45',
					movingPath === entry.path && 'animate-pulse',
					isDropTarget &&
						!dropError &&
						'bg-sidebar-accent text-sidebar-foreground ring-1 ring-sidebar-ring',
					isDropTarget && dropError && 'ring-1 ring-destructive'
				)}
			>
				<TreeIcon
					hasChildren={isDirectory}
					className="mr-0 shrink-0 text-sidebar-muted [&_svg]:h-3.5 [&_svg]:w-3.5"
				/>
				{editing ? (
					<Input
						ref={renameInputRef}
						autoFocus
						aria-invalid={Boolean(renameError)}
						value={renameName}
						disabled={renaming}
						className="h-5 min-w-0 flex-1 rounded-sm px-1.5 text-[12px] shadow-none"
						onBlur={() => {
							if (cancelBlurRef.current) {
								cancelBlurRef.current = false;
								return;
							}
							onRenameCommit();
						}}
						onChange={(event) => onRenameNameChange(event.target.value)}
						onClick={(event) => event.stopPropagation()}
						onContextMenu={(event) => event.stopPropagation()}
						onDoubleClick={(event) => event.stopPropagation()}
						onFocus={(event) => {
							const extensionStart = renameName.lastIndexOf('.');
							event.currentTarget.setSelectionRange(
								0,
								entry.type === 'file' && extensionStart > 0
									? extensionStart
									: renameName.length
							);
						}}
						onKeyDown={(event) => {
							event.stopPropagation();
							if (event.key === 'Enter') {
								event.preventDefault();
								event.currentTarget.blur();
							}
							if (event.key === 'Escape') {
								event.preventDefault();
								cancelBlurRef.current = true;
								onRenameCancel();
							}
						}}
						onPointerDown={(event) => event.stopPropagation()}
					/>
				) : (
					<TreeLabel className="text-[12px] font-medium">{entry.name}</TreeLabel>
				)}
			</TreeNodeTrigger>
			{editing && renameError ? (
				<p role="alert" className="px-6 py-1 text-[10px] leading-4 text-destructive">
					{renameError}
				</p>
			) : null}
			<TreeNodeContent hasChildren={isDirectory} className="space-y-1">
				{entry.children?.map((child, index) => (
					<WorkspaceTreeItem
						key={child.path}
						depth={depth + 1}
						draggedPath={draggedPath}
						dropError={dropError}
						dropTargetPath={dropTargetPath}
						entry={child}
						expanded={expanded}
						isLast={index === (entry.children?.length ?? 0) - 1}
						movingPath={movingPath}
						onCreateDirectory={onCreateDirectory}
						onCreateFile={onCreateFile}
						onDeleteRequest={onDeleteRequest}
						onDuplicateRequest={onDuplicateRequest}
						onArchiveRequest={onArchiveRequest}
						onRenameCancel={onRenameCancel}
						onRenameCommit={onRenameCommit}
						onRenameNameChange={onRenameNameChange}
						onRenameRequest={onRenameRequest}
						onDragEnd={onDragEnd}
						onDragLeave={onDragLeave}
						onDragOver={onDragOver}
						onDragStart={onDragStart}
						onDrop={onDrop}
						onSelect={onSelect}
						onToggle={onToggle}
						selectedPath={selectedPath}
						renameError={renameError}
						renameName={renameName}
						renameTarget={renameTarget}
						renaming={renaming}
					/>
				))}
			</TreeNodeContent>
		</TreeNode>
	);
}
