import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { hotkeysCoreFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { app, isKucedr, type WorkspaceTreeEntry } from '@kucedr/sdk';

import { HeadlessTreeItem } from '@/components/headless-tree-item';
import { Tree } from '@/components/ui/tree';
import { cn } from '@/lib/utils';
import { workspaceMoveError } from '@/lib/drop';
import { showNativeContextMenu } from '@/lib/menu';
import { rebaseWorkspacePath } from '@/lib/rebase';
import { collectDirectoryPaths } from '@/lib/tree';
import { isWorkspacePathWithin } from '@/lib/within';
import { filterWorkspaceEntries } from '@/lib/filter';
import { workspaceExpandedFoldersKey } from '@/lib/settings';

const hiddenWorkspacePaths = new Set<string>([
	'AGENTS.md',
	'HEALTH.md',
	'IDENTITY.md',
	'SOUL.md',
	'USER.md',
]);

const workspaceRootId = '__workspace_root__';

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
	const [expandedLoaded, setExpandedLoaded] = useState(false);
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
	const treeEntries = useMemo(() => {
		const entries = new Map<string, WorkspaceTreeEntry>();
		const addEntries = (items: WorkspaceTreeEntry[]) => {
			for (const item of items) {
				entries.set(item.path, item);
				if (item.children) addEntries(item.children);
			}
		};
		addEntries(regularFiles);
		return entries;
	}, [regularFiles]);
	useEffect(() => {
		let active = true;
		if (!isKucedr()) {
			setExpandedLoaded(true);
			return () => {
				active = false;
			};
		}
		void app
			.getAppStoreValue<string[]>(workspaceExpandedFoldersKey)
			.then((stored) => {
				if (!active || !Array.isArray(stored)) return;
				setExpanded(new Set(stored.filter((path): path is string => typeof path === 'string')));
			})
			.catch(() => undefined)
			.finally(() => {
				if (active) setExpandedLoaded(true);
			});
		return () => {
			active = false;
		};
	}, []);
	useEffect(() => {
		if (!expandedLoaded || !isKucedr()) return;
		void app.setAppStoreValue(workspaceExpandedFoldersKey, [...expanded]);
	}, [expanded, expandedLoaded]);
	useEffect(() => {
		if (!expandedLoaded || workspaceLoading) return;
		const folderPaths = new Set(
			[...treeEntries.values()]
				.filter((entry) => entry.type === 'directory')
				.map((entry) => entry.path)
		);
		setExpanded((current) => {
			const next = new Set([...current].filter((path) => folderPaths.has(path)));
			return next.size === current.size ? current : next;
		});
	}, [expandedLoaded, treeEntries, workspaceLoading]);
	const expandedItems = useMemo(() => [...expanded], [expanded]);
	const setExpandedItems = useCallback((next: string[] | ((current: string[]) => string[])) => {
		setExpanded((current) => new Set(typeof next === 'function' ? next([...current]) : next));
	}, []);
	const tree = useTree<WorkspaceTreeEntry>({
		dataLoader: {
			getChildren: (itemId) =>
				itemId === workspaceRootId
					? regularFiles.map((entry) => entry.path)
					: treeEntries.get(itemId)?.children?.map((entry) => entry.path) ?? [],
			getItem: (itemId) =>
				itemId === workspaceRootId
					? ({ name: 'Workspace', path: workspaceRootId, type: 'directory', children: regularFiles } as WorkspaceTreeEntry)
					: treeEntries.get(itemId)!,
		},
		features: [syncDataLoaderFeature, hotkeysCoreFeature],
		getItemName: (item) => item.getItemData().name,
		indent: 14,
		isItemFolder: (item) => item.getItemData().type === 'directory',
		rootItemId: workspaceRootId,
		state: { expandedItems },
		setExpandedItems,
	});
	useEffect(() => {
		tree.rebuildTree();
	}, [regularFiles, tree]);
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
	const treeItems = tree.getItems().filter((item) => treeEntries.has(item.getId()));

	function createFile(parentPath: string) {
		if (parentPath) setExpanded((current) => new Set(current).add(parentPath));
		onCreateFile(parentPath);
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
				className="min-h-0 flex-1 overflow-y-auto px-2 py-2 scrollbar-subtle"
				aria-label="Workspace files"
			>
				<p id="workspace-drag-instructions" className="sr-only">
					Drag files and folders onto a folder or an empty sidebar area to move them.
				</p>
				<Tree
					className="space-y-0.5"
					indent={14}
					tree={tree}
				>
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
							treeItems.map((item) => {
								const entry = item.getItemData();
								return (
									<HeadlessTreeItem
									key={item.getId()}
									draggedPath={draggedEntry?.path ?? null}
									dropError={dropError}
									dropTargetPath={dropTargetPath}
									entry={entry}
									item={item}
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
									selected={entry.path === selectedWorkspacePath}
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
								/>
								);
							})
						)}
				</Tree>
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
