import { Bot } from 'lucide-react';
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { WorkspaceTreeEntry } from '@kucedr/sdk';

import { Badge } from '@/components/ui/badge';
import {
	TreeExpander,
	TreeIcon,
	TreeLabel,
	TreeNode,
	TreeNodeContent,
	TreeNodeTrigger,
	TreeProvider,
	TreeView,
} from '@/components/kibo-ui/tree';
import { WorkspaceTreeItem } from '@/components/workspace-tree-item';
import { cn } from '@/lib/utils';
import { workspaceMoveError } from '@/lib/drop';
import { showNativeContextMenu } from '@/lib/menu';
import { rebaseWorkspacePath } from '@/lib/rebase';
import { collectDirectoryPaths } from '@/lib/tree';
import { isWorkspacePathWithin } from '@/lib/within';

const agentFilePaths = [
	'AGENTS.md',
	'HEALTH.md',
	'IDENTITY.md',
	'MEMORY.md',
	'SOUL.md',
	'USER.md',
] as const;
const agentFilePathSet = new Set<string>(agentFilePaths);
const agentNodeId = '__kucedr_workspace_agent__';

interface AppSidebarProps {
	onCreateDirectory: (parentPath: string) => void;
	onCreateFile: (parentPath: string) => void;
	onDeleteRequest: (entry: WorkspaceTreeEntry) => void;
	onDuplicateRequest: (entry: WorkspaceTreeEntry) => void;
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
	const agentFiles = useMemo(
		() =>
			agentFilePaths.flatMap((path) => {
				const entry = workspaceFiles.find(
					(candidate) => candidate.type === 'file' && candidate.path === path
				);
				return entry ? [entry] : [];
			}),
		[workspaceFiles]
	);
	const regularFiles = useMemo(
		() =>
			workspaceFiles.filter((entry) => entry.type !== 'file' || !agentFilePathSet.has(entry.path)),
		[workspaceFiles]
	);
	const agentExpanded = expanded.has(agentNodeId);
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
				'flex h-full w-full flex-col bg-sidebar text-sidebar-foreground',
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
							enabled: regularFiles.length > 0 || agentFiles.length > 0,
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
							if (agentFiles.length > 0) paths.add(agentNodeId);
							setExpanded(paths);
						},
						'collapse-all': () => setExpanded(new Set()),
						'copy-workspace-path': () => navigator.clipboard.writeText(workspaceLocation),
					}
				);
			}}
		>
			<nav
				className="min-h-0 flex-1 overflow-y-auto px-2 py-2 scrollbar-subtle"
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
						{!workspaceLoading && !workspaceError && agentFiles.length > 0 ? (
							<TreeNode nodeId={agentNodeId}>
								<TreeNodeTrigger
									data-workspace-entry
									expandOnClick
									role="treeitem"
									tabIndex={0}
									aria-expanded={agentExpanded}
									className="mx-0 h-7 gap-1.5 rounded-md px-0 py-0 pr-2 text-[12px] font-semibold text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-1 focus-visible:ring-sidebar-ring"
									onContextMenu={(event) => {
										showNativeContextMenu(
											event,
											[
												{ id: 'new-file', label: 'New File' },
												{ type: 'separator' },
												{
													id: 'toggle-agent',
													label: agentExpanded ? 'Collapse Agent' : 'Expand Agent',
												},
											],
											{
												'new-file': () => createFile(''),
												'toggle-agent': () => toggleDirectory(agentNodeId),
											}
										);
									}}
									onKeyDown={(event) => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											toggleDirectory(agentNodeId);
										}
									}}
								>
									<TreeExpander hasChildren className="mr-0 shrink-0" />
									<TreeIcon
										hasChildren
										icon={<Bot className="h-3.5 w-3.5" strokeWidth={1.8} />}
										className="mr-0 shrink-0 text-sidebar-muted"
									/>
									<TreeLabel className="text-[12px] font-semibold">Agent</TreeLabel>
									<Badge
										variant="secondary"
										className="h-4 border-0 bg-sidebar-accent px-1.5 text-[10px] text-sidebar-foreground"
									>
										{agentFiles.length}
									</Badge>
								</TreeNodeTrigger>
								<TreeNodeContent hasChildren className="space-y-1">
									{agentFiles.map((entry, index) => (
										<WorkspaceTreeItem
											key={entry.path}
											depth={1}
											draggedPath={draggedEntry?.path ?? null}
											dropError={dropError}
											dropTargetPath={dropTargetPath}
											entry={entry}
											expanded={expanded}
											isLast={index === agentFiles.length - 1}
											movingPath={movingPath}
											onCreateDirectory={onCreateDirectory}
											onCreateFile={createFile}
											onDeleteRequest={onDeleteRequest}
											onDuplicateRequest={onDuplicateRequest}
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
									))}
								</TreeNodeContent>
							</TreeNode>
						) : null}
						{workspaceLoading ? (
							<div className="px-3 py-2 text-[12px] text-sidebar-muted">Loading files...</div>
						) : workspaceError ? (
							<div className="px-3 py-2 text-[12px] leading-5 text-sidebar-muted">
								{workspaceError}
							</div>
						) : regularFiles.length === 0 && agentFiles.length === 0 ? (
							<div className="px-3 py-2 text-[12px] text-sidebar-muted">No files</div>
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
