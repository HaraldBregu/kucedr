import type { WorkspaceTreeEntry } from '@kucedr/sdk';
import type { DragEvent } from 'react';

import {
	TreeExpander,
	TreeIcon,
	TreeLabel,
	TreeNode,
	TreeNodeContent,
	TreeNodeTrigger,
} from '@/components/kibo-ui/tree';
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
	onCreateRequest: (parentPath: string, type: 'file' | 'directory') => void;
	onDeleteRequest: (entry: WorkspaceTreeEntry) => void;
	onRenameRequest: (entry: WorkspaceTreeEntry) => void;
	onDragEnd: () => void;
	onDragLeave: (event: DragEvent<HTMLElement>, path: string) => void;
	onDragOver: (event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) => void;
	onDragStart: (event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) => void;
	onDrop: (event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) => void;
	onSelect: (entry: WorkspaceTreeEntry) => void;
	onToggle: (path: string) => void;
	selectedPath: string | null;
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
	onCreateRequest,
	onDeleteRequest,
	onRenameRequest,
	onDragEnd,
	onDragLeave,
	onDragOver,
	onDragStart,
	onDrop,
	onSelect,
	onToggle,
	selectedPath,
}: WorkspaceTreeItemProps) {
	const isDirectory = entry.type === 'directory';
	const isExpanded = expanded.has(entry.path);
	const selected = selectedPath === entry.path;
	const isDropTarget = dropTargetPath === entry.path;

	return (
		<TreeNode isLast={isLast} level={depth} nodeId={entry.path}>
			<TreeNodeTrigger
				data-workspace-entry
				draggable={!movingPath}
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
							...(isDirectory
								? ([
										{ type: 'separator' },
										{ id: 'new-file', label: 'New File' },
										{ id: 'new-folder', label: 'New Folder' },
									] as const)
								: []),
							{ type: 'separator' },
							{ id: 'rename', label: isDirectory ? 'Rename Folder' : 'Rename File' },
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
							'new-file': () => onCreateRequest(entry.path, 'file'),
							'new-folder': () => onCreateRequest(entry.path, 'directory'),
							rename: () => onRenameRequest(entry),
							'copy-path': () => navigator.clipboard.writeText(entry.path),
							delete: () => onDeleteRequest(entry),
						}
					);
				}}
				onDoubleClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onRenameRequest(entry);
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
					'mx-0 h-7 gap-1.5 rounded-md px-0 py-0 pr-2 text-left text-[12px] font-medium text-sidebar-muted outline-none',
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
				<TreeExpander hasChildren={isDirectory} className="mr-0 shrink-0" />
				<TreeIcon
					hasChildren={isDirectory}
					className="mr-0 shrink-0 text-sidebar-muted [&_svg]:h-3.5 [&_svg]:w-3.5"
				/>
				<TreeLabel className="text-[12px] font-medium">{entry.name}</TreeLabel>
			</TreeNodeTrigger>
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
						onCreateRequest={onCreateRequest}
						onDeleteRequest={onDeleteRequest}
						onRenameRequest={onRenameRequest}
						onDragEnd={onDragEnd}
						onDragLeave={onDragLeave}
						onDragOver={onDragOver}
						onDragStart={onDragStart}
						onDrop={onDrop}
						onSelect={onSelect}
						onToggle={onToggle}
						selectedPath={selectedPath}
					/>
				))}
			</TreeNodeContent>
		</TreeNode>
	);
}
