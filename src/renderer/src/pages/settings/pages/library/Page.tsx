import React, { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, Folder, Library, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { workspaceFileType } from '../../../../../../shared/workspace';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useChatSession } from '@/contexts/chat-session';
import { saveDraftAttachments } from '../../../home/attachments/save';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';
import { LibraryTable } from './Table';
import { LibraryCard } from './Card';
import { LibraryModal } from './Modal';
import { LibraryHeaderActions } from './Header';
import { LibraryFolderDialog } from './FolderDialog';
import { LibrarySelection } from './Selection';
import { LibraryPath } from './Path';
import { libraryParent } from './parent';
import { LIBRARY_DRAG_TYPE } from './drag';
import { sortLibraryFiles, type LibrarySort, type LibrarySortKey } from './sort';

const FILE_BATCH_SIZE = 48;

const LibraryPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { setSessionId } = useChatSession();
	const [files, setFiles] = useState<LibraryFile[]>([]);
	const [currentFolder, setCurrentFolder] = useState('');
	const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
	const [visibleCount, setVisibleCount] = useState(FILE_BATCH_SIZE);
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<'collections' | 'list'>('list');
	const [sort, setSort] = useState<LibrarySort>({ key: 'name', direction: 'asc' });
	const [previewFile, setPreviewFile] = useState<LibraryFile | null>(null);
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [folderDialogOpen, setFolderDialogOpen] = useState(false);
	const [selectionBusy, setSelectionBusy] = useState(false);
	const [moving, setMoving] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [deletingPath, setDeletingPath] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState('');
	const currentFiles = useMemo(
		() => files.filter((file) => libraryParent(file.relativePath) === currentFolder),
		[files, currentFolder]
	);
	const orderedFiles = useMemo(() => sortLibraryFiles(currentFiles, sort), [currentFiles, sort]);
	const navigateFolder = useCallback((folder: string): void => {
		setCurrentFolder(folder.replaceAll('\\', '/'));
		setSelectedPaths(new Set());
		setVisibleCount(FILE_BATCH_SIZE);
		setPreviewFile(null);
		setErrorMessage('');
	}, []);
	const selectedFiles = useMemo(
		() => files.filter((file) => file.kind !== 'folder' && selectedPaths.has(file.relativePath)),
		[files, selectedPaths]
	);
	const handleSelect = useCallback((path: string, selected: boolean): void => {
		setSelectedPaths((current) => {
			const next = new Set(current);
			if (selected) next.add(path);
			else next.delete(path);
			return next;
		});
	}, []);
	const handleSelectAll = useCallback((entries: LibraryFile[], selected: boolean): void => {
		setSelectedPaths((current) => {
			const next = new Set(current);
			for (const file of entries) {
				if (selected) next.add(file.relativePath);
				else next.delete(file.relativePath);
			}
			return next;
		});
	}, []);
	const handleSort = useCallback((key: LibrarySortKey): void => {
		setSort((current) => ({
			key,
			direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
		}));
	}, []);

	const loadFiles = useCallback(async (): Promise<void> => {
		setLoading(true);
		setErrorMessage('');
		try {
			const nextFiles = await window.library.list();
			setFiles(nextFiles);
			setCurrentFolder((current) =>
				current &&
				!nextFiles.some(
					(file) => file.kind === 'folder' && file.relativePath.replaceAll('\\', '/') === current
				)
					? ''
					: current
			);
			setSelectedPaths(new Set());
			setVisibleCount(FILE_BATCH_SIZE);
		} catch {
			setErrorMessage(t('settings.library.loadError'));
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void loadFiles();
	}, [loadFiles]);

	useEffect(() => {
		const target = loadMoreRef.current;
		if (
			!target ||
			visibleCount >= currentFiles.length ||
			typeof IntersectionObserver === 'undefined'
		)
			return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setVisibleCount((current) => Math.min(current + FILE_BATCH_SIZE, currentFiles.length));
				}
			},
			{ rootMargin: '300px' }
		);
		observer.observe(target);
		return () => observer.disconnect();
	}, [currentFiles.length, visibleCount, loading]);

	const handleOpenFolder = useCallback(async (): Promise<void> => {
		setErrorMessage('');
		try {
			await window.library.openRoot();
		} catch {
			setErrorMessage(t('settings.library.openFolderError'));
		}
	}, [t]);

	const handleUpload = useCallback(async (): Promise<void> => {
		setUploading(true);
		setErrorMessage('');
		try {
			const uploaded = await window.library.select(currentFolder);
			if (uploaded) await loadFiles();
		} catch {
			setErrorMessage(t('settings.library.uploadError'));
		} finally {
			setUploading(false);
		}
	}, [currentFolder, loadFiles, t]);

	const handleCreateFolder = useCallback(
		async (name: string): Promise<void> => {
			setErrorMessage('');
			try {
				await window.library.createFolder(name, currentFolder);
				await loadFiles();
			} catch {
				setErrorMessage(t('settings.library.createFolderError'));
				throw new Error('Folder creation failed');
			}
		},
		[currentFolder, loadFiles, t]
	);

	const handleStartChat = useCallback((): void => {
		const sessionId = crypto.randomUUID();
		saveDraftAttachments(
			sessionId,
			selectedFiles.map((file) => ({
				id: crypto.randomUUID(),
				kind: 'file' as const,
				file: new File([], file.name, { type: workspaceFileType(file.name).mimeType ?? '' }),
				path: file.path,
			}))
		);
		setSessionId(sessionId);
		navigate('/home');
		window.requestAnimationFrame(() => window.dispatchEvent(new Event('kucedr:focus-chat-input')));
	}, [navigate, selectedFiles, setSessionId]);

	const handleDownload = useCallback(async (): Promise<void> => {
		setSelectionBusy(true);
		setErrorMessage('');
		try {
			await window.library.download(selectedFiles.map((file) => file.relativePath));
		} catch {
			setErrorMessage(t('settings.library.downloadError'));
		} finally {
			setSelectionBusy(false);
		}
	}, [selectedFiles, t]);

	const handleDeleteSelected = useCallback(async (): Promise<void> => {
		if (
			!window.confirm(t('settings.library.confirmDeleteSelected', { count: selectedFiles.length }))
		)
			return;
		setSelectionBusy(true);
		setErrorMessage('');
		try {
			for (const file of selectedFiles) await window.library.delete(file.relativePath);
			setFiles((current) => current.filter((file) => !selectedPaths.has(file.relativePath)));
			setSelectedPaths(new Set());
		} catch {
			setErrorMessage(t('settings.library.deleteError'));
			await loadFiles();
		} finally {
			setSelectionBusy(false);
		}
	}, [loadFiles, selectedFiles, selectedPaths, t]);

	const handleMove = useCallback(
		async (paths: string[], folder: string): Promise<void> => {
			if (moving) return;
			setMoving(true);
			setErrorMessage('');
			try {
				await window.library.move(paths, folder);
				await loadFiles();
			} catch {
				await loadFiles();
				setErrorMessage(t('settings.library.moveError'));
			} finally {
				setMoving(false);
			}
		},
		[loadFiles, moving, t]
	);

	const handleDrop = useCallback(
		async (event: DragEvent<HTMLDivElement>): Promise<void> => {
			event.preventDefault();
			if (event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
			setDragging(false);
			const paths = Array.from(event.dataTransfer.files)
				.map((file) => window.app.getPathForFile(file))
				.filter(Boolean);
			if (paths.length === 0) return;

			setUploading(true);
			setErrorMessage('');
			try {
				await window.library.add(paths, currentFolder);
				await loadFiles();
			} catch {
				setErrorMessage(t('settings.library.uploadError'));
			} finally {
				setUploading(false);
			}
		},
		[currentFolder, loadFiles, t]
	);

	const handleDelete = useCallback(
		async (file: LibraryFile): Promise<void> => {
			if (!window.confirm(t('settings.library.confirmDelete', { name: file.name }))) return;
			setDeletingPath(file.relativePath);
			setErrorMessage('');
			try {
				await window.library.delete(file.relativePath);
				setFiles((current) => current.filter((entry) => entry.relativePath !== file.relativePath));
				setSelectedPaths((current) => {
					const next = new Set(current);
					next.delete(file.relativePath);
					return next;
				});
				setPreviewFile((current) => (current?.relativePath === file.relativePath ? null : current));
			} catch {
				setErrorMessage(t('settings.library.deleteError'));
			} finally {
				setDeletingPath(null);
			}
		},
		[t]
	);

	const handleContextMenu = useCallback(
		(file: LibraryFile): void => {
			void window.win
				.showContextMenu(
					file.kind === 'folder'
						? [{ id: 'open-folder', label: t('settings.library.openFolder') }]
						: [
								{ id: 'preview', label: t('settings.library.preview') },
								{ id: 'open-folder', label: t('settings.library.openFolder') },
								{ type: 'separator' },
								{
									id: 'delete',
									label: t('settings.library.delete', { name: file.name }),
									enabled: deletingPath !== file.relativePath && !uploading,
								},
							]
				)
				.then((action) => {
					if (action === 'preview') setPreviewFile(file);
					else if (action === 'open-folder') {
						if (file.kind === 'folder') navigateFolder(file.relativePath);
						else void handleOpenFolder();
					} else if (action === 'delete') void handleDelete(file);
				})
				.catch(() => setErrorMessage(t('settings.library.contextMenuError')));
		},
		[deletingPath, handleDelete, handleOpenFolder, navigateFolder, t, uploading]
	);

	return (
		<SettingsPageShell className="max-w-none">
			<SettingsPageHeader
				title={t('library.title')}
				description={t('settings.library.description')}
				action={
					<LibraryHeaderActions
						view={view}
						onViewChange={(next) => {
							setView(next);
							setSelectedPaths(new Set());
						}}
						onCreateFolder={() => setFolderDialogOpen(true)}
						onOpenFolder={() => void handleOpenFolder()}
						onUpload={() => void handleUpload()}
						disabled={loading || uploading}
					/>
				}
			/>

			{errorMessage && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{errorMessage}
				</SettingsNotice>
			)}

			<section className="flex flex-col gap-2">
				<LibraryPath
					folder={currentFolder}
					onNavigate={navigateFolder}
					onMove={(paths, folder) => void handleMove(paths, folder)}
				/>
				<div
					role="region"
					aria-label={t('settings.library.dropZone')}
					className={cn(
						'relative rounded-xl transition-shadow',
						dragging && 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background'
					)}
					onDragEnter={(event) => {
						if (
							event.dataTransfer.types.includes('Files') &&
							!event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)
						)
							setDragging(true);
					}}
					onDragOver={(event) => {
						if (event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
						if (!event.dataTransfer.types.includes('Files')) return;
						event.preventDefault();
						event.dataTransfer.dropEffect = 'copy';
					}}
					onDragLeave={(event) => {
						if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
							setDragging(false);
						}
					}}
					onDrop={(event) => void handleDrop(event)}
				>
					{dragging && (
						<div className="flex items-center justify-center gap-2 bg-muted/60 px-4 py-3 text-xs font-medium text-foreground">
							<Upload className="size-3.5" />
							{t('settings.library.drop')}
						</div>
					)}
					{loading ? (
						<SettingsPanel>
							<SettingsLoadingRows rows={3} />
						</SettingsPanel>
					) : currentFiles.length === 0 ? (
						<SettingsPanel>
							<SettingsEmptyState
								icon={currentFolder ? Folder : Library}
								title={currentFolder ? t('settings.library.emptyFolder') : t('library.empty')}
								description={
									currentFolder
										? t('settings.library.emptyFolderDescription')
										: t('settings.library.emptyDescription')
								}
							/>
						</SettingsPanel>
					) : view === 'collections' ? (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4">
							{orderedFiles.slice(0, visibleCount).map((file) => (
								<LibraryCard
									key={file.relativePath}
									file={file}
									selectedPaths={selectedPaths}
									disabled={deletingPath === file.relativePath || uploading || moving}
									onDelete={(entry) => void handleDelete(entry)}
									onOpenFolder={(entry) => navigateFolder(entry.relativePath)}
									onMove={(paths, folder) => void handleMove(paths, folder)}
									onContextMenu={handleContextMenu}
								/>
							))}
						</div>
					) : (
						<LibraryTable
							files={orderedFiles.slice(0, visibleCount)}
							sort={sort}
							onSort={handleSort}
							selectedPaths={selectedPaths}
							onSelect={handleSelect}
							onSelectAll={handleSelectAll}
							onOpenFolder={(entry) => navigateFolder(entry.relativePath)}
							onMove={(paths, folder) => void handleMove(paths, folder)}
							onContextMenu={handleContextMenu}
						/>
					)}
					{visibleCount < currentFiles.length && (
						<div ref={loadMoreRef} className="flex justify-center py-4">
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									setVisibleCount((current) =>
										Math.min(current + FILE_BATCH_SIZE, currentFiles.length)
									)
								}
							>
								{t('settings.library.loadMore')}
							</Button>
						</div>
					)}
				</div>
			</section>
			<LibraryModal
				file={previewFile}
				files={orderedFiles.filter((file) => file.kind !== 'folder')}
				onClose={() => setPreviewFile(null)}
				onNavigate={setPreviewFile}
			/>
			<LibraryFolderDialog
				open={folderDialogOpen}
				onOpenChange={setFolderDialogOpen}
				onCreate={handleCreateFolder}
			/>
			{selectedFiles.length > 0 && (
				<LibrarySelection
					count={selectedFiles.length}
					onStartChat={handleStartChat}
					onDownload={() => void handleDownload()}
					onDelete={() => void handleDeleteSelected()}
					onOpenFolder={() => void handleOpenFolder()}
					onMoveUp={() =>
						void handleMove(
							selectedFiles.map((file) => file.relativePath),
							libraryParent(currentFolder)
						)
					}
					canMoveUp={Boolean(currentFolder)}
					onClear={() => setSelectedPaths(new Set())}
					busy={selectionBusy}
				/>
			)}
		</SettingsPageShell>
	);
};

export default LibraryPage;
