import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent,
} from 'react';
import { File, FilePlus2, Folder, FolderPlus, Search, Settings } from 'lucide-react';

import {
	agent,
	app,
	isKucedr,
	win,
	workspaceFileType,
	type AppThemeData,
	type WorkspaceFileKind,
	type WorkspaceTreeEntry,
} from '@kucedr/sdk';
import { AppSidebar } from '@/components/app-sidebar';
import { WorkspaceViewer } from '@/components/workspace-viewer';
import { WorkspaceSettingsView } from '@/components/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarInset,
	SidebarProvider,
	SidebarResizeHandle,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { showNativeContextMenu } from '@/lib/menu';
import { availableWorkspaceName } from '@/lib/available';
import { findWorkspaceEntry } from '@/lib/find';
import { removeWorkspaceEntry } from '@/lib/remove';
import { rebaseWorkspacePath } from '@/lib/rebase';
import { isWorkspacePathWithin } from '@/lib/within';
import { searchWorkspaceEntries } from '@/lib/search';
import { useNavigationBar } from '@/hooks/navigationbar';
import {
	workspaceSettingsDefaults,
	workspaceSettingsKey,
	type WorkspaceSettings,
} from '@/lib/settings';

const fallbackTheme: AppThemeData = {
	themeMode: 'light',
	isDark: false,
	colors: {},
};
const sidebarMinWidth = 200;
const sidebarMaxWidth = 360;
const sidebarDefaultWidth = 240;
const editableWorkspaceKinds = new Set<WorkspaceFileKind>([
	'markdown',
	'mermaid',
	'excalidraw',
	'tldraw',
	'text',
]);

export default function App() {
	const [theme, setTheme] = useState<AppThemeData>(fallbackTheme);
	const [workspaceLocation, setWorkspaceLocation] = useState('');
	const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceTreeEntry[]>([]);
	const [workspaceLoading, setWorkspaceLoading] = useState(false);
	const [workspaceError, setWorkspaceError] = useState('');
	const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string | null>(null);
	const [selectedKind, setSelectedKind] = useState<WorkspaceFileKind | null>(null);
	const [selectedContent, setSelectedContent] = useState('');
	const [selectedSavedContent, setSelectedSavedContent] = useState('');
	const [selectedMediaUrl, setSelectedMediaUrl] = useState('');
	const [selectedLoading, setSelectedLoading] = useState(false);
	const [selectedError, setSelectedError] = useState('');
	const [selectedSaving, setSelectedSaving] = useState(false);
	const [selectedSaveError, setSelectedSaveError] = useState('');
	const [markdownMode, setMarkdownMode] = useState<'source' | 'preview'>('source');
	const [createRequest, setCreateRequest] = useState<{
		parentPath: string;
	} | null>(null);
	const [createName, setCreateName] = useState('');
	const [createError, setCreateError] = useState('');
	const [creating, setCreating] = useState(false);
	const [renameTarget, setRenameTarget] = useState<WorkspaceTreeEntry | null>(null);
	const [renameName, setRenameName] = useState('');
	const [renameError, setRenameError] = useState('');
	const [renaming, setRenaming] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<WorkspaceTreeEntry | null>(null);
	const [deleteError, setDeleteError] = useState('');
	const [deleting, setDeleting] = useState(false);
	const [sidebarWidth, setSidebarWidth] = useState(sidebarDefaultWidth);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [view, setView] = useState<'workspace' | 'settings'>('workspace');
	const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(
		workspaceSettingsDefaults
	);
	const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false);
	const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
	const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
	const [globalSearchQuery, setGlobalSearchQuery] = useState('');
	const [fileFindRequest, setFileFindRequest] = useState(0);
	const sidebarSearchInputRef = useRef<HTMLInputElement>(null);
	const globalSearchInputRef = useRef<HTMLInputElement>(null);
	const selectedPathRef = useRef<string | null>(null);
	const selectedContentRef = useRef('');
	const saveInFlightRef = useRef<Promise<boolean> | null>(null);
	const saveSnapshotRef = useRef<{ filePath: string; content: string } | null>(null);
	const closeAfterSaveRef = useRef(false);
	const allowCloseRef = useRef(false);
	const deletingScopeRef = useRef<string | null>(null);
	const selectionRequestRef = useRef(0);
	const selectedEditable = selectedKind !== null && editableWorkspaceKinds.has(selectedKind);
	const selectedDirty = selectedEditable && selectedContent !== selectedSavedContent;
	const selectedWorkspaceEntry = useMemo(
		() => findWorkspaceEntry(workspaceFiles, selectedWorkspacePath),
		[workspaceFiles, selectedWorkspacePath]
	);
	const globalSearchResults = useMemo(
		() => searchWorkspaceEntries(workspaceFiles, globalSearchQuery),
		[globalSearchQuery, workspaceFiles]
	);
	useNavigationBar({ sidebarOpen, sidebarWidth, setSidebarOpen });
	useEffect(() => {
		if (!isKucedr()) return;

		let active = true;

		app
			.getThemeData()
			.then((themeData) => {
				if (active) setTheme(themeData);
			})
			.catch(() => undefined);

		const unsubscribe = app.onThemeModeChanged((themeData) => {
			if (active) setTheme(themeData);
		});

		return () => {
			active = false;
			unsubscribe();
		};
	}, []);

	useEffect(() => {
		if (!isKucedr()) return;
		void app
			.getAppStoreValue<Record<string, string | number | boolean>>(workspaceSettingsKey)
			.then((stored) => {
			if (!stored) return;
			const settings = {
				fontSize:
					typeof stored.fontSize === 'number'
						? Math.min(24, Math.max(10, stored.fontSize))
						: workspaceSettingsDefaults.fontSize,
				formatted:
					typeof stored.formatted === 'boolean'
						? stored.formatted
						: workspaceSettingsDefaults.formatted,
				lineNumbers:
					typeof stored.lineNumbers === 'boolean'
						? stored.lineNumbers
						: workspaceSettingsDefaults.lineNumbers,
				wordWrap:
					typeof stored.wordWrap === 'boolean'
						? stored.wordWrap
						: workspaceSettingsDefaults.wordWrap,
			};
			setWorkspaceSettings(settings);
			setMarkdownMode(settings.formatted ? 'preview' : 'source');
		});
	}, []);

	useEffect(() => {
		const root = document.documentElement;
		root.classList.toggle('dark', theme.isDark);
		for (const [name, value] of Object.entries(theme.colors)) {
			root.style.setProperty(`--${name}`, value);
		}
	}, [theme]);

	useEffect(() => {
		if (!sidebarSearchOpen) return;
		sidebarSearchInputRef.current?.focus();
	}, [sidebarSearchOpen]);

	useEffect(() => {
		if (!globalSearchOpen) return;
		globalSearchInputRef.current?.focus();
	}, [globalSearchOpen]);

	useEffect(() => {
		const openFileSearch = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'f') return;
			event.preventDefault();
			event.stopPropagation();
			const activeElement = document.activeElement;
			if (activeElement?.closest('#workspace-sidebar')) {
				setSidebarOpen(true);
				setSidebarSearchOpen(true);
				return;
			}
			const canFindInSelectedFile =
				selectedKind === 'text' || (selectedKind === 'markdown' && markdownMode === 'source');
			if (activeElement?.closest('[aria-label="Workspace file"]') && canFindInSelectedFile) {
				setFileFindRequest((request) => request + 1);
				return;
			}
			setGlobalSearchOpen(true);
		};
		window.addEventListener('keydown', openFileSearch, true);
		return () => window.removeEventListener('keydown', openFileSearch, true);
	}, [markdownMode, selectedKind]);

	const setSidebarVisibility = useCallback((open: boolean): void => {
		setSidebarOpen(open);
	}, []);

	useEffect(() => {
		if (!isKucedr()) return;

		let active = true;
		let refreshTimer: ReturnType<typeof setTimeout> | undefined;
		const unsubscribe = agent.onWorkspaceChanged(() => {
			clearTimeout(refreshTimer);
			refreshTimer = setTimeout(() => {
				agent
					.listWorkspaceFiles()
					.then((files) => {
						if (!active) return;
						setWorkspaceFiles(files);
						setWorkspaceError('');
					})
					.catch((error) => {
						if (active)
							setWorkspaceError(
								error instanceof Error ? error.message : 'Unable to refresh workspace.'
							);
					});
			}, 100);
		});
		setWorkspaceLoading(true);
		setWorkspaceError('');

		Promise.all([agent.getWorkspaceLocation(), agent.listWorkspaceFiles()])
			.then(([location, files]) => {
				if (!active) return;
				setWorkspaceLocation(location);
				setWorkspaceFiles(files);
			})
			.catch((error) => {
				if (active)
					setWorkspaceError(error instanceof Error ? error.message : 'Unable to load workspace.');
			})
			.finally(() => {
				if (active) setWorkspaceLoading(false);
			});

		return () => {
			active = false;
			clearTimeout(refreshTimer);
			unsubscribe();
		};
	}, []);

	const saveWorkspaceFile = useCallback(
		async function saveWorkspaceFile(
			filePath = selectedPathRef.current,
			content = selectedContent
		): Promise<boolean> {
			if (
				!filePath ||
				selectedKind === null ||
				!editableWorkspaceKinds.has(selectedKind) ||
				!isKucedr() ||
				(deletingScopeRef.current
					? isWorkspacePathWithin(filePath, deletingScopeRef.current)
					: false)
			) {
				return false;
			}
			const pendingSave = saveInFlightRef.current;
			if (pendingSave) {
				const pendingSnapshot = saveSnapshotRef.current;
				if (pendingSnapshot?.filePath === filePath && pendingSnapshot.content === content) {
					return pendingSave;
				}
				await pendingSave;
				return saveWorkspaceFile(filePath, content);
			}

			setSelectedSaving(true);
			setSelectedSaveError('');
			saveSnapshotRef.current = { filePath, content };
			const operation = Promise.resolve()
				.then(() => agent.writeWorkspaceFile(filePath, content))
				.then(() => {
					if (selectedPathRef.current === filePath) setSelectedSavedContent(content);
					return true;
				})
				.catch((error) => {
					if (selectedPathRef.current === filePath) {
						setSelectedSaveError(
							error instanceof Error ? error.message : 'Unable to save the workspace file.'
						);
					}
					return false;
				})
				.finally(() => {
					saveInFlightRef.current = null;
					saveSnapshotRef.current = null;
					if (selectedPathRef.current === filePath) setSelectedSaving(false);
				});
			saveInFlightRef.current = operation;
			return operation;
		},
		[selectedContent, selectedKind]
	);

	const saveLatestWorkspaceFile = useCallback(
		async function saveLatestWorkspaceFile(filePath = selectedPathRef.current): Promise<boolean> {
			if (!filePath) return false;
			let content = selectedContentRef.current;
			while (selectedPathRef.current === filePath) {
				const saved = await saveWorkspaceFile(filePath, content);
				if (!saved) return false;
				const latestContent = selectedContentRef.current;
				if (latestContent === content) return true;
				content = latestContent;
			}
			return false;
		},
		[saveWorkspaceFile]
	);

	useEffect(() => {
		if (!selectedDirty || selectedSaving || selectedSaveError) return;
		const timeout = window.setTimeout(() => {
			void saveWorkspaceFile(selectedPathRef.current, selectedContent);
		}, 700);
		return () => window.clearTimeout(timeout);
	}, [saveWorkspaceFile, selectedContent, selectedDirty, selectedSaveError, selectedSaving]);

	useEffect(() => {
		if (!selectedDirty && !selectedSaving) return;
		const preventUnsavedClose = (event: BeforeUnloadEvent) => {
			if (allowCloseRef.current) return;
			if (selectedSaveError && !selectedSaving) {
				allowCloseRef.current = true;
				return;
			}
			event.preventDefault();
			event.returnValue = 'Changes are still being saved.';
			if (closeAfterSaveRef.current) return;
			closeAfterSaveRef.current = true;
			void saveLatestWorkspaceFile(selectedPathRef.current).then((saved) => {
				closeAfterSaveRef.current = false;
				if (!saved) return;
				allowCloseRef.current = true;
				win.close();
			});
		};
		window.addEventListener('beforeunload', preventUnsavedClose);
		return () => window.removeEventListener('beforeunload', preventUnsavedClose);
	}, [saveLatestWorkspaceFile, selectedDirty, selectedSaveError, selectedSaving]);

	async function selectWorkspaceEntry(entry: WorkspaceTreeEntry) {
		if (entry.type !== 'file') return;
		if (
			selectedKind !== null &&
			editableWorkspaceKinds.has(selectedKind) &&
			(selectedContent !== selectedSavedContent || selectedSaving)
		) {
			const saved = await saveLatestWorkspaceFile(selectedPathRef.current);
			if (!saved) return;
		}

		const requestId = selectionRequestRef.current + 1;
		selectionRequestRef.current = requestId;
		const kind = workspaceFileType(entry.path).kind;
		selectedPathRef.current = entry.path;
		setSelectedWorkspacePath(entry.path);
		setSelectedKind(kind);
		selectedContentRef.current = '';
		setSelectedContent('');
		setSelectedSavedContent('');
		setSelectedError('');
		setSelectedSaveError('');
		setSelectedMediaUrl('');

		if (kind === 'unsupported') {
			setSelectedLoading(false);
			return;
		}

		setSelectedLoading(true);
		try {
			if (['image', 'audio', 'video', 'pdf'].includes(kind)) {
				const url = new URL('local-resource://agent/');
				url.pathname = `/${entry.path.replaceAll('\\', '/')}`;
				setSelectedMediaUrl(url.toString());
			} else {
				const content = await agent.readWorkspaceFile(entry.path);
				if (selectionRequestRef.current !== requestId) return;
				selectedContentRef.current = content;
				setSelectedContent(content);
				setSelectedSavedContent(content);
			}
		} catch (error) {
			if (selectionRequestRef.current === requestId) {
				setSelectedError(error instanceof Error ? error.message : 'Unable to read file.');
			}
		} finally {
			if (selectionRequestRef.current === requestId) setSelectedLoading(false);
		}
	}

	function startCreateWorkspaceDirectory(parentPath: string) {
		setCreateRequest({ parentPath });
		setCreateName('New Folder');
		setCreateError('');
	}

	async function createWorkspaceFile(parentPath: string) {
		if (creating || !isKucedr()) return;
		const parent = parentPath ? findWorkspaceEntry(workspaceFiles, parentPath) : null;
		const name = availableWorkspaceName(parent?.children ?? (parentPath ? [] : workspaceFiles));
		setCreating(true);
		setWorkspaceError('');
		try {
			const createdPath = await agent.createWorkspaceFile(parentPath, name);
			setWorkspaceFiles(await agent.listWorkspaceFiles());
			await selectWorkspaceEntry({ name, path: createdPath, type: 'file' });
			startRenameWorkspaceEntry({ name, path: createdPath, type: 'file' });
		} catch (error) {
			setWorkspaceError(error instanceof Error ? error.message : 'Unable to create the file.');
		} finally {
			setCreating(false);
		}
	}

	async function confirmCreateWorkspaceEntry() {
		if (!createRequest || creating || !isKucedr()) return;
		const baseName = createName.trim();
		if (!baseName) {
			setCreateError('Enter a name.');
			return;
		}
		setCreating(true);
		setCreateError('');
		try {
			await agent.createWorkspaceDirectory(createRequest.parentPath, baseName);
			setWorkspaceFiles(await agent.listWorkspaceFiles());
			setWorkspaceError('');
			setCreateRequest(null);
		} catch (error) {
			setCreateError(error instanceof Error ? error.message : 'Unable to create the item.');
		} finally {
			setCreating(false);
		}
	}

	function startRenameWorkspaceEntry(entry: WorkspaceTreeEntry) {
		setRenameTarget(entry);
		setRenameName(entry.name);
		setRenameError('');
	}

	async function confirmRenameWorkspaceEntry() {
		if (!renameTarget || renaming || !isKucedr()) return;
		const name = renameName.trim();
		if (!name || name === renameTarget.name) {
			setRenameTarget(null);
			setRenameError('');
			return;
		}

		const target = renameTarget;
		const selectedPath = selectedPathRef.current;
		const renamesSelection = Boolean(
			selectedPath && isWorkspacePathWithin(selectedPath, target.path)
		);
		setRenaming(true);
		setRenameError('');
		if (
			renamesSelection &&
			selectedKind !== null &&
			editableWorkspaceKinds.has(selectedKind) &&
			(selectedContentRef.current !== selectedSavedContent || selectedSaving)
		) {
			const saved = await saveLatestWorkspaceFile(selectedPath);
			if (!saved) {
				setRenameError('Save the selected file before renaming it.');
				setRenaming(false);
				return;
			}
		}

		let renamedPath: string;
		try {
			renamedPath = await agent.renameWorkspaceEntry(target.path, name);
		} catch (error) {
			setRenameError(error instanceof Error ? error.message : 'Unable to rename the item.');
			setRenaming(false);
			return;
		}

		setRenameTarget(null);
		if (renamesSelection && selectedPath) {
			const renamedSelectedPath = rebaseWorkspacePath(selectedPath, target.path, renamedPath);
			await selectWorkspaceEntry({
				name: renamedSelectedPath.split('/').pop() ?? renamedSelectedPath,
				path: renamedSelectedPath,
				type: 'file',
			});
		}
		try {
			setWorkspaceFiles(await agent.listWorkspaceFiles());
			setWorkspaceError('');
		} catch (error) {
			setWorkspaceError(
				error instanceof Error
					? `Item renamed, but the workspace could not refresh: ${error.message}`
					: 'Item renamed, but the workspace could not refresh.'
			);
		} finally {
			setRenaming(false);
		}
	}

	async function confirmDeleteWorkspaceEntry() {
		if (!deleteTarget || deleting || !isKucedr()) return;
		const target = deleteTarget;
		const targetPath = target.path;
		deletingScopeRef.current = targetPath;
		setDeleting(true);
		setDeleteError('');
		let deletionFailed = false;
		try {
			if (
				saveInFlightRef.current &&
				saveSnapshotRef.current &&
				isWorkspacePathWithin(saveSnapshotRef.current.filePath, targetPath)
			) {
				await saveInFlightRef.current;
			}
			if (target.type === 'directory') await agent.deleteWorkspaceDirectory(targetPath);
			else await agent.deleteWorkspaceFile(targetPath);
			setWorkspaceFiles((current) => removeWorkspaceEntry(current, targetPath));
			if (selectedPathRef.current && isWorkspacePathWithin(selectedPathRef.current, targetPath)) {
				selectionRequestRef.current += 1;
				selectedPathRef.current = null;
				selectedContentRef.current = '';
				setSelectedWorkspacePath(null);
				setSelectedKind(null);
				setSelectedContent('');
				setSelectedSavedContent('');
				setSelectedMediaUrl('');
				setSelectedLoading(false);
				setSelectedError('');
				setSelectedSaveError('');
			}
			setDeleteTarget(null);
			try {
				setWorkspaceFiles(await agent.listWorkspaceFiles());
			} catch (error) {
				setWorkspaceError(
					error instanceof Error
						? `Item deleted, but the workspace could not refresh: ${error.message}`
						: 'Item deleted, but the workspace could not refresh.'
				);
			}
		} catch (error) {
			deletionFailed = true;
			setDeleteError(
				error instanceof Error
					? error.message
					: `Unable to delete the ${target.type === 'directory' ? 'folder' : 'file'}.`
			);
		} finally {
			deletingScopeRef.current = null;
			setDeleting(false);
		}
		if (
			deletionFailed &&
			selectedPathRef.current &&
			isWorkspacePathWithin(selectedPathRef.current, targetPath) &&
			selectedContentRef.current !== selectedSavedContent
		) {
			void saveWorkspaceFile(selectedPathRef.current, selectedContentRef.current);
		}
	}

	async function duplicateWorkspaceEntry(entry: WorkspaceTreeEntry) {
		if (entry.type !== 'file' || !isKucedr()) return;
		setWorkspaceError('');
		try {
			const duplicatedPath = await agent.duplicateWorkspaceFile(entry.path);
			setWorkspaceFiles(await agent.listWorkspaceFiles());
			await selectWorkspaceEntry({
				name: duplicatedPath.split('/').pop() ?? duplicatedPath,
				path: duplicatedPath,
				type: 'file',
			});
		} catch (error) {
			setWorkspaceError(error instanceof Error ? error.message : 'Unable to duplicate the file.');
		}
	}

	async function archiveWorkspaceEntry(
		entry: WorkspaceTreeEntry,
		action: 'compress' | 'extract'
	) {
		if (!isKucedr()) return;
		setWorkspaceError('');
		try {
			await agent.archiveWorkspaceEntry(entry.path, action);
			setWorkspaceFiles(await agent.listWorkspaceFiles());
		} catch (error) {
			setWorkspaceError(
				error instanceof Error
					? error.message
					: `Unable to ${action === 'compress' ? 'create' : 'extract'} the ZIP archive.`
			);
		}
	}

	async function moveWorkspaceEntry(
		entry: WorkspaceTreeEntry,
		destinationPath: string
	): Promise<string> {
		if (!isKucedr()) throw new Error('Workspace moves are only available inside Kucedr.');
		const currentSelectedPath = selectedPathRef.current;
		const movesSelection = Boolean(
			currentSelectedPath && isWorkspacePathWithin(currentSelectedPath, entry.path)
		);
		if (
			movesSelection &&
			selectedKind !== null &&
			editableWorkspaceKinds.has(selectedKind) &&
			(selectedContentRef.current !== selectedSavedContent || selectedSaving)
		) {
			const saved = await saveLatestWorkspaceFile(currentSelectedPath);
			if (!saved) throw new Error('Save the selected file before moving it.');
		}

		const movedPath = await agent.moveWorkspaceEntry(entry.path, destinationPath);
		const refresh = agent.listWorkspaceFiles();
		if (movesSelection && currentSelectedPath) {
			const movedSelectedPath = rebaseWorkspacePath(currentSelectedPath, entry.path, movedPath);
			await selectWorkspaceEntry({
				name: movedSelectedPath.split('/').pop() ?? movedSelectedPath,
				path: movedSelectedPath,
				type: 'file',
			});
		}
		try {
			setWorkspaceFiles(await refresh);
			setWorkspaceError('');
		} catch (error) {
			throw new Error(
				error instanceof Error
					? `Item moved, but the workspace could not refresh: ${error.message}`
					: 'Item moved, but the workspace could not refresh.'
			);
		}
		return movedPath;
	}

	function startSidebarResize(event: PointerEvent<HTMLButtonElement>) {
		event.preventDefault();
		const startX = event.clientX;
		const startWidth = sidebarWidth;

		const resize = (moveEvent: globalThis.PointerEvent) => {
			const nextWidth = Math.min(
				sidebarMaxWidth,
				Math.max(sidebarMinWidth, startWidth + moveEvent.clientX - startX)
			);
			setSidebarWidth(nextWidth);
		};
		const stop = () => {
			window.removeEventListener('pointermove', resize);
			window.removeEventListener('pointerup', stop);
		};

		window.addEventListener('pointermove', resize);
		window.addEventListener('pointerup', stop, { once: true });
	}

	const sidebar = (
		<AppSidebar
			onCreateDirectory={startCreateWorkspaceDirectory}
			onCreateFile={createWorkspaceFile}
			onDeleteRequest={(entry) => {
				setDeleteError('');
				setDeleteTarget(entry);
			}}
			onDuplicateRequest={duplicateWorkspaceEntry}
			onArchiveRequest={archiveWorkspaceEntry}
			onMoveRequest={moveWorkspaceEntry}
			onRenameRequest={startRenameWorkspaceEntry}
			onRenameCancel={() => {
				if (renaming) return;
				setRenameTarget(null);
				setRenameError('');
			}}
			onRenameCommit={confirmRenameWorkspaceEntry}
			onRenameNameChange={(name) => {
				setRenameName(name);
				setRenameError('');
			}}
			renameError={renameError}
			renameName={renameName}
			renameTarget={renameTarget}
			renaming={renaming}
			onWorkspaceSelect={(entry) => {
				setView('workspace');
				void selectWorkspaceEntry(entry);
			}}
			selectedWorkspacePath={selectedWorkspacePath}
			workspaceError={workspaceError}
			workspaceFiles={workspaceFiles}
			workspaceLoading={workspaceLoading}
			workspaceLocation={workspaceLocation}
			searchQuery={sidebarSearchQuery}
		/>
	);
	return (
		<TooltipProvider delayDuration={400}>
			<SidebarProvider
				className="flex h-dvh min-h-[520px] overflow-hidden bg-background text-foreground"
				onOpenChange={setSidebarVisibility}
				open={sidebarOpen}
				onContextMenu={(event) => {
					showNativeContextMenu(
						event,
						[
							{ id: 'new-file', label: 'New File' },
							{ id: 'new-folder', label: 'New Folder' },
							{ type: 'separator' },
							{
								id: 'copy-workspace-path',
								label: 'Copy Workspace Path',
								enabled: Boolean(workspaceLocation),
							},
						],
						{
							'new-file': () => void createWorkspaceFile(''),
							'new-folder': () => startCreateWorkspaceDirectory(''),
							'copy-workspace-path': () => navigator.clipboard.writeText(workspaceLocation),
						}
					);
				}}
			>
				<Sidebar id="workspace-sidebar" collapsible="offcanvas" width={sidebarWidth}>
					<div
						className="flex h-12 shrink-0 items-center gap-1 border-b border-sidebar-border px-2"
						style={{ WebkitAppRegion: 'drag' } as CSSProperties}
					>
						<span className="min-w-0 flex-1 truncate px-1 text-xs font-semibold">Workspace</span>
						<div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								title="New folder"
								aria-label="New folder"
								onClick={() => startCreateWorkspaceDirectory('')}
							>
								<FolderPlus />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								title="New file"
								aria-label="New file"
								onClick={() => void createWorkspaceFile('')}
							>
								<FilePlus2 />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								title="Search files (⌘/Ctrl+F)"
								aria-label="Search files"
								aria-pressed={sidebarSearchOpen}
								onClick={() => {
									setSidebarSearchOpen((open) => !open);
									if (sidebarSearchOpen) setSidebarSearchQuery('');
								}}
							>
								<Search />
							</Button>
						</div>
					</div>
					{sidebarSearchOpen ? (
						<div className="shrink-0 border-b border-sidebar-border p-2">
							<Input
								ref={sidebarSearchInputRef}
								autoFocus
								value={sidebarSearchQuery}
								placeholder="Search files..."
								aria-label="Search workspace files"
								className="h-7 text-xs"
								onChange={(event) => setSidebarSearchQuery(event.target.value)}
								onKeyDown={(event) => {
									if (event.key !== 'Escape') return;
									setSidebarSearchOpen(false);
									setSidebarSearchQuery('');
								}}
							/>
						</div>
					) : null}
					<SidebarContent>{sidebar}</SidebarContent>
					<SidebarFooter>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							aria-current={view === 'settings' ? 'page' : undefined}
							className="w-full justify-start gap-2 aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"
							onClick={() => setView('settings')}
						>
							<Settings /> Settings
						</Button>
					</SidebarFooter>
					<SidebarResizeHandle
						onPointerDown={startSidebarResize}
						onContextMenu={(event) => {
							showNativeContextMenu(
								event,
								[
									{
										id: 'minimum',
										label: 'Minimum Width',
										enabled: sidebarWidth !== sidebarMinWidth,
									},
									{
										id: 'reset',
										label: 'Reset Width',
										enabled: sidebarWidth !== sidebarDefaultWidth,
									},
									{
										id: 'maximum',
										label: 'Maximum Width',
										enabled: sidebarWidth !== sidebarMaxWidth,
									},
								],
								{
									minimum: () => setSidebarWidth(sidebarMinWidth),
									reset: () => setSidebarWidth(sidebarDefaultWidth),
									maximum: () => setSidebarWidth(sidebarMaxWidth),
								}
							);
						}}
					/>
				</Sidebar>

				<SidebarInset>
					{view === 'settings' ? (
						<WorkspaceSettingsView
							settings={workspaceSettings}
							onChange={(settings) => {
								setWorkspaceSettings(settings);
								if (isKucedr()) {
									void app.setAppStoreValue(workspaceSettingsKey, {
										fontSize: settings.fontSize,
										formatted: settings.formatted,
										lineNumbers: settings.lineNumbers,
										wordWrap: settings.wordWrap,
									});
								}
							}}
						/>
					) : (
					<WorkspaceViewer
						content={selectedContent}
						dirty={selectedDirty}
						error={selectedError}
						file={selectedWorkspaceEntry?.type === 'file' ? selectedWorkspaceEntry : null}
						workspaceFiles={workspaceFiles}
						kind={selectedKind}
						findRequest={fileFindRequest}
						isDark={theme.isDark}
						loading={selectedLoading}
						markdownMode={markdownMode}
						mediaUrl={selectedMediaUrl}
						onChange={(content) => {
							selectedContentRef.current = content;
							setSelectedContent(content);
							setSelectedSaveError('');
						}}
						onFileSelect={(entry) => void selectWorkspaceEntry(entry)}
						onMarkdownModeChange={(mode) => {
							setMarkdownMode(mode);
							const settings = { ...workspaceSettings, formatted: mode === 'preview' };
							setWorkspaceSettings(settings);
							if (isKucedr()) {
								void app.setAppStoreValue(workspaceSettingsKey, settings);
							}
						}}
						onRename={() => {
							if (!selectedWorkspacePath) return;
							startRenameWorkspaceEntry({
								name: selectedWorkspacePath.split(/[\\/]/).pop() ?? selectedWorkspacePath,
								path: selectedWorkspacePath,
								type: 'file',
							});
						}}
						onSave={() => saveWorkspaceFile(selectedPathRef.current, selectedContent)}
						path={selectedWorkspacePath}
						saving={selectedSaving}
						settings={workspaceSettings}
					/>
					)}
				</SidebarInset>
			</SidebarProvider>

			<Dialog
				open={globalSearchOpen}
				onOpenChange={(open) => {
					setGlobalSearchOpen(open);
					if (!open) setGlobalSearchQuery('');
				}}
			>
				<DialogContent className="top-16 max-w-lg -translate-y-0 gap-2 p-2">
					<DialogTitle className="sr-only">Search workspace files and folders</DialogTitle>
					<div className="flex items-center gap-2 px-1">
						<Search className="size-4 shrink-0 text-muted-foreground" />
						<Input
							ref={globalSearchInputRef}
							autoFocus
							value={globalSearchQuery}
							placeholder="Search files and folders"
							aria-label="Search files and folders"
							className="border-0 shadow-none focus-visible:ring-0"
							onChange={(event) => setGlobalSearchQuery(event.target.value)}
						/>
					</div>
					<div className="max-h-72 overflow-y-auto px-1 pb-1 scrollbar-subtle">
						{globalSearchQuery.trim() ? (
							globalSearchResults.length > 0 ? (
								globalSearchResults.map((entry) => (
									<Button
										key={entry.path}
										type="button"
										variant="ghost"
										className="h-auto w-full justify-start gap-2 px-2 py-2 text-left"
										onClick={() => {
											setGlobalSearchOpen(false);
											setGlobalSearchQuery('');
											if (entry.type === 'file') {
												void selectWorkspaceEntry(entry);
											} else {
												setSidebarOpen(true);
												setSidebarSearchOpen(true);
												setSidebarSearchQuery(entry.name);
											}
										}}
									>
										{entry.type === 'directory' ? <Folder /> : <File />}
										<span className="min-w-0 flex-1 truncate">{entry.name}</span>
										<span className="shrink-0 text-[11px] font-normal text-muted-foreground">
											{entry.path}
										</span>
									</Button>
								))
							) : (
								<p className="px-2 py-3 text-xs text-muted-foreground">No matching files or folders.</p>
							)
						) : (
							<p className="px-2 py-3 text-xs text-muted-foreground">Search workspace files and folders.</p>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(createRequest)}
				onOpenChange={(open) => {
					if (!open && !creating) {
						setCreateRequest(null);
						setCreateError('');
					}
				}}
			>
				<DialogContent
					onContextMenu={(event) => {
						showNativeContextMenu(
							event,
							[
								{ id: 'cancel', label: 'Cancel', enabled: !creating },
								{
									id: 'create',
									label: 'Create Folder',
									enabled: !creating && Boolean(createName.trim()),
								},
							],
							{
								cancel: () => setCreateRequest(null),
								create: () => confirmCreateWorkspaceEntry(),
							}
						);
					}}
				>
					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							void confirmCreateWorkspaceEntry();
						}}
					>
						<DialogHeader>
							<DialogTitle>
								Create Folder
							</DialogTitle>
							<DialogDescription>
								{createRequest?.parentPath
									? `Create it inside ${createRequest.parentPath}.`
									: 'Create it at the workspace root.'}
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-1.5">
							<label htmlFor="workspace-entry-name" className="text-xs font-medium">
								Name
							</label>
							<Input
									id="workspace-entry-name"
									autoFocus
									value={createName}
									disabled={creating}
									onChange={(event) => {
										setCreateName(event.target.value);
										setCreateError('');
									}}
									onContextMenu={(event) => {
										showNativeContextMenu(event, [
											{ type: 'role', role: 'undo' },
											{ type: 'role', role: 'redo' },
											{ type: 'separator' },
											{ type: 'role', role: 'cut' },
											{ type: 'role', role: 'copy' },
											{ type: 'role', role: 'paste' },
											{ type: 'separator' },
											{ type: 'role', role: 'selectAll' },
										]);
									}}
								/>
						</div>
						{createError ? <p className="text-xs text-destructive">{createError}</p> : null}
						<DialogFooter>
							<DialogClose asChild>
								<Button type="button" variant="outline" disabled={creating}>
									Cancel
								</Button>
							</DialogClose>
							<Button type="submit" disabled={creating || !createName.trim()}>
								{creating
									? 'Creating…'
									: 'Create Folder'}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(deleteTarget)}
				onOpenChange={(open) => {
					if (!open && !deleting) {
						setDeleteTarget(null);
						setDeleteError('');
					}
				}}
			>
				<DialogContent
					onContextMenu={(event) => {
						showNativeContextMenu(
							event,
							[
								{ id: 'cancel', label: 'Cancel', enabled: !deleting },
								{
									id: 'delete',
									label: deleteTarget?.type === 'directory' ? 'Delete Folder' : 'Delete File',
									enabled: !deleting,
								},
							],
							{
								cancel: () => setDeleteTarget(null),
								delete: () => confirmDeleteWorkspaceEntry(),
							}
						);
					}}
				>
					<DialogHeader>
						<DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
						<DialogDescription>
							{deleteTarget?.type === 'directory'
								? 'This permanently deletes the folder and everything inside it. This action cannot be undone.'
								: 'This permanently deletes the file from the agent workspace. This action cannot be undone.'}
						</DialogDescription>
					</DialogHeader>
					{deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline" disabled={deleting}>
								Cancel
							</Button>
						</DialogClose>
						<Button
							type="button"
							variant="destructive"
							disabled={deleting}
							onClick={() => void confirmDeleteWorkspaceEntry()}
						>
							{deleting
								? 'Deleting…'
								: `Delete ${deleteTarget?.type === 'directory' ? 'Folder' : 'File'}`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</TooltipProvider>
	);
}
