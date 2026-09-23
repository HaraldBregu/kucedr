import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { WorkspaceTreeEntry } from '@kucedr/sdk';

import { TreeProvider, TreeView } from '@/components/kibo-ui/tree';
import { WorkspaceTreeItem } from '@/components/workspace-tree-item';
import { cn } from '@/lib/utils';
import { workspaceMoveError } from '@/lib/drop';
import { showNativeContextMenu } from '@/lib/menu';
import { rebaseWorkspacePath } from '@/lib/rebase';
import { collectDirectoryPaths } from '@/lib/tree';
import { isWorkspacePathWithin } from '@/lib/within';
import { filterWorkspaceEntries } from '@/lib/filter';

const hiddenWorkspacePaths = new Set<string>([
	'AGENTS.md',
	'HEALTH.md',
	'IDENTITY.md',
	'SOUL.md',
	'USER.md',
]);

interface AppSidebarProps {
	onCreateDirectory: (parentPath: string) => void;
	onCreateFile: (parentPath: string) => void;
	onDeleteRequest: (entry: WorkspaceTreeEntry) => void;
	onDuplicateRequest: (entry: WorkspaceTreeEntry) => void;
	onArchiveRequest: (entry: WorkspaceTreeEntry, action: 'compress' | 'extract') => void;
	onMoveRequest: (entry: WorkspaceTreeEntry, destinationPath: string) => Promise<string>;
	onRenameCancel: () => void;
	onRenameCommit: () => void;
	onRenameNameChange: (name: string) => void;
	onRenameRequest: (entry: WorkspaceTreeEntry) => void;
	onWorkspaceSelect: (entry: WorkspaceTreeEntry) => void;
	selectedWorkspacePath: string | null;
	workspaceError: string;
	workspaceFiles: WorkspaceTreeEntry[];
	workspaceLoading: boolean;
	workspaceLocation: string;
	searchQuery: string;
	renameError: string;
	renameName: string;
	renameTarget: WorkspaceTreeEntry | null;
	renaming: boolean;
}

export function AppSidebar({
	onCreateDirectory,
	onCreateFile,
	onDeleteRequest,
	onDuplicateRequest,
	onArchiveRequest,
	onMoveRequest,
	onRenameCancel,
	onRenameCommit,
	onRenameNameChange,
	onRenameRequest,
	onWorkspaceSelect,
	selectedWorkspacePath,
	workspaceError,
	workspaceFiles,
	workspaceLoading,
	workspaceLocation,
	searchQuery,
	renameError,
	renameName,
	renameTarget,
	renaming,
}: AppSidebarProps) {
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [draggedEntry, setDraggedEntry] = useState<WorkspaceTreeEntry | null>(null);
	const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
	const [dropError, setDropError] = useState('');
	const [dragMessage, setDragMessage] = useState('');
	const [movingPath, setMovingPath] = useState<string | null>(null);
	const visibleWorkspaceFiles = useMemo(
		() => filterWorkspaceEntries(workspaceFiles, searchQuery),
		[searchQuery, workspaceFiles]
	);
	const regularFiles = useMemo(
		() =>
			visibleWorkspaceFiles.filter(
				(entry) => entry.type !== 'file' || !hiddenWorkspacePaths.has(entry.path)
			),
		[visibleWorkspaceFiles]
	);
	useEffect(() => {
		if (!searchQuery.trim()) return;
		setExpanded((current) => {
			const next = new Set(current);
			for (const path of collectDirectoryPaths(regularFiles)) next.add(path);
			return next;
		});
	}, [regularFiles, searchQuery]);
	useEffect(() => {
		if (!renameTarget) return;
		const parts = renameTarget.path.split('/');
		if (parts.length < 2) return;
		setExpanded((current) => {
			const next = new Set(current);
			for (let index = 1; index < parts.length; index += 1) {
				next.add(parts.slice(0, index).join('/'));
			}
			return next;
		});
	}, [renameTarget]);

	function createFile(parentPath: string) {
		if (parentPath) setExpanded((current) => new Set(current).add(parentPath));
		onCreateFile(parentPath);
	}
	function toggleDirectory(path: string) {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}

	function startDrag(event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) {
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('application/x-kucedr-workspace-entry', entry.path);
		event.dataTransfer.setData('text/plain', entry.path);
		setDraggedEntry(entry);
		setDropTargetPath(null);
		setDropError('');
		setDragMessage(`Moving ${entry.name}. Drop it onto a folder or the workspace root.`);
	}

	function endDrag() {
		if (draggedEntry && !movingPath) setDragMessage(dropError || 'Move canceled.');
		setDraggedEntry(null);
		setDropTargetPath(null);
		setDropError('');
	}

	function dragOverEntry(event: DragEvent<HTMLElement>, entry: WorkspaceTreeEntry) {
		if (!draggedEntry || movingPath) return;
		event.preventDefault();
		event.stopPropagation();
		const error =
			entry.type === 'directory'
				? workspaceMoveError(draggedEntry, entry.path, entry.children ?? [])
				: 'Drop onto a folder or an empty area to move this item.';
		event.dataTransfer.dropEffect = error ? 'none' : 'move';
		setDropTargetPath(entry.path);
		setDropError(error);
	}

	function dragLeaveTarget(event: DragEvent<HTMLElement>, path: string) {
		if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
			return;
		}
		if (dropTargetPath === path) {
			setDropTargetPath(null);
			setDropError('');
		}
	}

	async function moveEntry(
		event: DragEvent<HTMLElement>,
		destinationPath: string,
		destinationEntries: WorkspaceTreeEntry[]
	) {
		if (!draggedEntry || movingPath) return;
		event.preventDefault();
		event.stopPropagation();
		const error = workspaceMoveError(draggedEntry, destinationPath, destinationEntries);
		if (error) {
			setDropError(error);
			setDragMessage(error);
			return;
		}

		const source = draggedEntry;
		setMovingPath(source.path);
		setDropError('');
		try {
			const movedPath = await onMoveRequest(source, destinationPath);
			setExpanded((current) => {
				const next = new Set<string>();
				for (const path of current) {
					next.add(
						isWorkspacePathWithin(path, source.path)
							? rebaseWorkspacePath(path, source.path, movedPath)
							: path
					);
				}
				if (destinationPath) next.add(destinationPath);
				return next;
			});
			setDragMessage(
				`Moved ${source.name} to ${destinationPath ? destinationPath : 'the workspace root'}.`
			);
		} catch (error) {
			setDragMessage(error instanceof Error ? error.message : 'Unable to move the item.');
		} finally {
			setMovingPath(null);
			setDraggedEntry(null);
			setDropTargetPath(null);
			setDropError('');
		}
	}

	function dragOverRoot(event: DragEvent<HTMLElement>) {
		if (!draggedEntry || movingPath) return;
		if ((event.target as Element).closest('[data-workspace-entry]')) return;
		event.preventDefault();
		const error = workspaceMoveError(draggedEntry, '', workspaceFiles);
		event.dataTransfer.dropEffect = error ? 'none' : 'move';
		setDropTargetPath('');
		setDropError(error);
	}

	function dropOnRoot(event: DragEvent<HTMLElement>) {
		if ((event.target as Element).closest('[data-workspace-entry]')) return;
		void moveEntry(event, '', workspaceFiles);
	}

	return (
		<div
			className={cn(
				'flex h-full w-full flex-col bg-background text-sidebar-foreground',
				dropTargetPath === '' && !dropError && 'ring-1 ring-inset ring-sidebar-ring',
				dropTargetPath === '' && dropError && 'ring-1 ring-inset ring-destructive'
			)}
			onDragOver={dragOverRoot}
			onDragLeave={(event) => dragLeaveTarget(event, '')}
			onDrop={dropOnRoot}
			onContextMenu={(event) => {
				showNativeContextMenu(
					event,
					[
						{ id: 'new-file', label: 'New File' },
						{ id: 'new-folder', label: 'New Folder' },
						{ type: 'separator' },
						{
							id: 'expand-all',
							label: 'Expand All',
							enabled: regularFiles.length > 0,
						},
						{
							id: 'collapse-all',
							label: 'Collapse All',
							enabled: expanded.size > 0,
						},
						{ type: 'separator' },
						{
							id: 'copy-workspace-path',
							label: 'Copy Workspace Path',
							enabled: Boolean(workspaceLocation),
						},
					],
					{
						'new-file': () => createFile(''),
						'new-folder': () => onCreateDirectory(''),
						'expand-all': () => {
							const paths = collectDirectoryPaths(regularFiles);
							setExpanded(paths);
						},
						'collapse-all': () => setExpanded(new Set()),
						'copy-workspace-path': () => navigator.clipboard.writeText(workspaceLocation),
					}
				);
			}}
		>
			<nav
				className="min-h-0 flex-1 overflow-y-auto px-1 py-2 scrollbar-subtle"
				aria-label="Workspace files"
			>
				<p id="workspace-drag-instructions" className="sr-only">
					Drag files and folders onto a folder or an empty sidebar area to move them.
				</p>
				<TreeProvider
					animateExpand={false}
					expandedIds={[...expanded]}
					indent={14}
					onExpandedChange={(ids) => setExpanded(new Set(ids))}
					selectedIds={selectedWorkspacePath ? [selectedWorkspacePath] : []}
					showLines={false}
				>
					<TreeView className="space-y-1 p-0" role="tree">
						{workspaceLoading ? (
							<div className="px-3 py-2 text-[12px] text-sidebar-muted">Loading files...</div>
						) : workspaceError ? (
							<div className="px-3 py-2 text-[12px] leading-5 text-sidebar-muted">
								{workspaceError}
							</div>
						) : regularFiles.length === 0 ? (
							<div className="px-3 py-2 text-[12px] text-sidebar-muted">
								{searchQuery.trim() ? 'No matching files' : 'No files'}
							</div>
						) : (
							regularFiles.map((entry, index) => (
								<WorkspaceTreeItem
									key={entry.path}
									depth={0}
									draggedPath={draggedEntry?.path ?? null}
									dropError={dropError}
									dropTargetPath={dropTargetPath}
									entry={entry}
									expanded={expanded}
									isLast={index === regularFiles.length - 1}
									movingPath={movingPath}
									onCreateDirectory={onCreateDirectory}
									onCreateFile={createFile}
									onDeleteRequest={onDeleteRequest}
									onDuplicateRequest={onDuplicateRequest}
									onArchiveRequest={onArchiveRequest}
									onRenameRequest={onRenameRequest}
									onRenameCancel={onRenameCancel}
									onRenameCommit={onRenameCommit}
									onRenameNameChange={onRenameNameChange}
									renameError={renameError}
									renameName={renameName}
									renameTarget={renameTarget}
									renaming={renaming}
									onDragEnd={endDrag}
									onDragLeave={dragLeaveTarget}
									onDragOver={dragOverEntry}
									onDragStart={startDrag}
									onDrop={(event, destination) => {
										if (destination.type === 'directory') {
											void moveEntry(event, destination.path, destination.children ?? []);
										}
									}}
									onSelect={onWorkspaceSelect}
									onToggle={toggleDirectory}
									selectedPath={selectedWorkspacePath}
								/>
							))
						)}
					</TreeView>
				</TreeProvider>
				{draggedEntry || dragMessage ? (
					<p
						role="status"
						aria-live="polite"
						className={cn(
							'mx-1 mt-2 rounded-md border border-sidebar-border/70 bg-sidebar-accent px-2 py-1.5 text-[11px] leading-4 text-sidebar-muted',
							dropError && 'border-destructive text-sidebar-foreground'
						)}
					>
						{dropError || dragMessage}
					</p>
				) : null}
			</nav>
		</div>
	);
}
