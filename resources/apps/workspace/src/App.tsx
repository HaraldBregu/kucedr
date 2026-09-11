import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type PointerEvent,
} from 'react';

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
	SidebarInset,
	SidebarProvider,
	SidebarResizeHandle,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { showNativeContextMenu } from '@/lib/menu';
import { findWorkspaceEntry } from '@/lib/find';
import { removeWorkspaceEntry } from '@/lib/remove';
import { rebaseWorkspacePath } from '@/lib/rebase';
import { isWorkspacePathWithin } from '@/lib/within';

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
]);
const createFilePresets = [
	{ kind: 'markdown', label: 'Markdown', name: 'Untitled.md' },
	{ kind: 'mermaid', label: 'Mermaid', name: 'Untitled.mmd' },
	{ kind: 'excalidraw', label: 'Excalidraw', name: 'Untitled.excalidraw' },
	{ kind: 'tldraw', label: 'tldraw', name: 'Untitled.tldr' },
] as const;
type CreateFileKind = (typeof createFilePresets)[number]['kind'];

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
		type: 'file' | 'directory';
	} | null>(null);
	const [createName, setCreateName] = useState('');
	const [createFileKind, setCreateFileKind] = useState<CreateFileKind>('markdown');
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
		const root = document.documentElement;
		root.classList.toggle('dark', theme.isDark);
		for (const [name, value] of Object.entries(theme.colors)) {
			root.style.setProperty(`--${name}`, value);
		}
	}, [theme]);

	const syncTitlebar = useCallback((open: boolean, width: number): void => {
		if (!isKucedr()) return;
		win.setTitlebarOptions({
			title: 'Workspace',
			leftButtons: [
				{
					id: 'toggle-sidebar',
					label: open ? 'Collapse sidebar' : 'Expand sidebar',
					icon: 'panel-left',
					expanded: open,
				},
			],
			rightButtons: [],
			sidebarOpen: open,
			sidebarWidth: width,
		});
	}, []);

	const setSidebarVisibility = useCallback(
		(open: boolean): void => {
			syncTitlebar(open, sidebarWidth);
			setSidebarOpen(open);
		},
		[sidebarWidth, syncTitlebar]
	);

	useLayoutEffect(() => {
		syncTitlebar(sidebarOpen, sidebarWidth);
	}, [sidebarOpen, sidebarWidth, syncTitlebar]);

	useEffect(() => {
		if (!isKucedr()) return;
		return () => win.setTitlebarOptions(null);
	}, []);

	useEffect(() => {
		if (!isKucedr()) return;
		return win.onTitlebarButtonClick((buttonId) => {
			if (buttonId === 'toggle-sidebar') setSidebarVisibility(!sidebarOpen);
		});
	}, [setSidebarVisibility, sidebarOpen]);

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
		setMarkdownMode('source');
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

	function startCreateWorkspaceEntry(parentPath: string, type: 'file' | 'directory') {
		setCreateRequest({ parentPath, type });
		setCreateFileKind('markdown');
		setCreateName(type === 'file' ? 'Untitled.md' : 'New Folder');
		setCreateError('');
	}

	async function confirmCreateWorkspaceEntry() {
		if (!createRequest || creating || !isKucedr()) return;
		const name = createName.trim();
		if (!name) {
			setCreateError('Enter a name.');
			return;
		}
		setCreating(true);
		setCreateError('');
		try {
			const createdPath =
				createRequest.type === 'directory'
					? await agent.createWorkspaceDirectory(createRequest.parentPath, name)
					: await agent.createWorkspaceFile(createRequest.parentPath, name);
			setWorkspaceFiles(await agent.listWorkspaceFiles());
			setWorkspaceError('');
			setCreateRequest(null);
			if (createRequest.type === 'file') {
				await selectWorkspaceEntry({ name, path: createdPath, type: 'file' });
			}
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
		if (!name) {
			setRenameError('Enter a name.');
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
			onCreateRequest={startCreateWorkspaceEntry}
			onDeleteRequest={(entry) => {
				setDeleteError('');
				setDeleteTarget(entry);
			}}
			onMoveRequest={moveWorkspaceEntry}
			onRenameRequest={startRenameWorkspaceEntry}
			onWorkspaceSelect={selectWorkspaceEntry}
			selectedWorkspacePath={selectedWorkspacePath}
			workspaceError={workspaceError}
			workspaceFiles={workspaceFiles}
			workspaceLoading={workspaceLoading}
			workspaceLocation={workspaceLocation}
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
							'new-file': () => startCreateWorkspaceEntry('', 'file'),
							'new-folder': () => startCreateWorkspaceEntry('', 'directory'),
							'copy-workspace-path': () => navigator.clipboard.writeText(workspaceLocation),
						}
					);
				}}
			>
				<Sidebar id="workspace-sidebar" collapsible="offcanvas" width={sidebarWidth}>
					<SidebarContent>{sidebar}</SidebarContent>
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
					<WorkspaceViewer
						content={selectedContent}
						dirty={selectedDirty}
						error={selectedError}
						file={selectedWorkspaceEntry?.type === 'file' ? selectedWorkspaceEntry : null}
						kind={selectedKind}
						isDark={theme.isDark}
						loading={selectedLoading}
						markdownMode={markdownMode}
						mediaUrl={selectedMediaUrl}
						onChange={(content) => {
							selectedContentRef.current = content;
							setSelectedContent(content);
							setSelectedSaveError('');
						}}
						onMarkdownModeChange={setMarkdownMode}
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
						saveError={selectedSaveError}
						saving={selectedSaving}
					/>
				</SidebarInset>
			</SidebarProvider>

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
									label: createRequest?.type === 'directory' ? 'Create Folder' : 'Create File',
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
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault();
							void confirmCreateWorkspaceEntry();
						}}
					>
						<DialogHeader>
							<DialogTitle>
								Create {createRequest?.type === 'directory' ? 'Folder' : 'File'}
							</DialogTitle>
							<DialogDescription>
								{createRequest?.parentPath
									? `Create it inside ${createRequest.parentPath}.`
									: 'Create it at the workspace root.'}
							</DialogDescription>
						</DialogHeader>
						{createRequest?.type === 'file' ? (
							<div className="space-y-2">
								<span className="text-sm font-medium">Type</span>
								<div className="grid grid-cols-2 gap-2" role="group" aria-label="File type">
									{createFilePresets.map((preset) => (
										<Button
											key={preset.kind}
											type="button"
											variant={createFileKind === preset.kind ? 'default' : 'outline'}
											onClick={() => {
												setCreateFileKind(preset.kind);
												setCreateName(preset.name);
												setCreateError('');
											}}
										>
											{preset.label}
										</Button>
									))}
								</div>
							</div>
						) : null}
						<div className="space-y-2">
							<label htmlFor="workspace-entry-name" className="text-sm font-medium">
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
						{createError ? <p className="text-sm text-destructive">{createError}</p> : null}
						<DialogFooter>
							<DialogClose asChild>
								<Button type="button" variant="outline" disabled={creating}>
									Cancel
								</Button>
							</DialogClose>
							<Button type="submit" disabled={creating || !createName.trim()}>
								{creating
									? 'Creating…'
									: `Create ${createRequest?.type === 'directory' ? 'Folder' : 'File'}`}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(renameTarget)}
				onOpenChange={(open) => {
					if (!open && !renaming) {
						setRenameTarget(null);
						setRenameError('');
					}
				}}
			>
				<DialogContent
					onContextMenu={(event) => {
						showNativeContextMenu(
							event,
							[
								{ id: 'cancel', label: 'Cancel', enabled: !renaming },
								{
									id: 'rename',
									label: renameTarget?.type === 'directory' ? 'Rename Folder' : 'Rename File',
									enabled:
										!renaming &&
										Boolean(renameName.trim()) &&
										renameName.trim() !== renameTarget?.name,
								},
							],
							{
								cancel: () => setRenameTarget(null),
								rename: () => confirmRenameWorkspaceEntry(),
							}
						);
					}}
				>
					<form
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault();
							void confirmRenameWorkspaceEntry();
						}}
					>
						<DialogHeader>
							<DialogTitle>
								Rename {renameTarget?.type === 'directory' ? 'Folder' : 'File'}
							</DialogTitle>
							<DialogDescription>Enter a new name for {renameTarget?.name}.</DialogDescription>
						</DialogHeader>
						<div className="space-y-2">
							<label htmlFor="workspace-entry-rename" className="text-sm font-medium">
								Name
							</label>
							<Input
								id="workspace-entry-rename"
								autoFocus
								value={renameName}
								disabled={renaming}
								onFocus={(event) => {
									const extensionStart = renameName.lastIndexOf('.');
									event.currentTarget.setSelectionRange(
										0,
										renameTarget?.type === 'file' && extensionStart > 0
											? extensionStart
											: renameName.length
									);
								}}
								onChange={(event) => {
									setRenameName(event.target.value);
									setRenameError('');
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
						{renameError ? <p className="text-sm text-destructive">{renameError}</p> : null}
						<DialogFooter>
							<DialogClose asChild>
								<Button type="button" variant="outline" disabled={renaming}>
									Cancel
								</Button>
							</DialogClose>
							<Button
								type="submit"
								disabled={
									renaming || !renameName.trim() || renameName.trim() === renameTarget?.name
								}
							>
								{renaming
									? 'Renaming…'
									: `Rename ${renameTarget?.type === 'directory' ? 'Folder' : 'File'}`}
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
					{deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
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
