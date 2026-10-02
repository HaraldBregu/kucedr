import React, { useCallback, useEffect, useState, type DragEvent } from 'react';
import { AlertTriangle, FolderOpen, LayoutGrid, Library, List, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';
import { LibraryRow } from './Row';
import { LibraryCard } from './Card';
import { LibraryModal } from './Modal';

const LibraryPage: React.FC = () => {
	const { t } = useTranslation();
	const [files, setFiles] = useState<LibraryFile[]>([]);
	const [view, setView] = useState<'collections' | 'list'>('collections');
	const [previewFile, setPreviewFile] = useState<LibraryFile | null>(null);
	const [root, setRoot] = useState('');
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [deletingPath, setDeletingPath] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState('');

	const loadFiles = useCallback(async (): Promise<void> => {
		setLoading(true);
		setErrorMessage('');
		try {
			const [nextFiles, nextRoot] = await Promise.all([
				window.library.list(),
				window.library.getRoot(),
			]);
			setFiles(nextFiles);
			setRoot(nextRoot);
		} catch {
			setErrorMessage(t('settings.library.loadError'));
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void loadFiles();
	}, [loadFiles]);

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
			const uploaded = await window.library.select();
			if (uploaded) await loadFiles();
		} catch {
			setErrorMessage(t('settings.library.uploadError'));
		} finally {
			setUploading(false);
		}
	}, [loadFiles, t]);

	const handleDrop = useCallback(
		async (event: DragEvent<HTMLDivElement>): Promise<void> => {
			event.preventDefault();
			setDragging(false);
			const paths = Array.from(event.dataTransfer.files)
				.map((file) => window.app.getPathForFile(file))
				.filter(Boolean);
			if (paths.length === 0) return;

			setUploading(true);
			setErrorMessage('');
			try {
				await window.library.add(paths);
				await loadFiles();
			} catch {
				setErrorMessage(t('settings.library.uploadError'));
			} finally {
				setUploading(false);
			}
		},
		[loadFiles, t]
	);

	const handleDelete = useCallback(
		async (file: LibraryFile): Promise<void> => {
			if (!window.confirm(t('settings.library.confirmDelete', { name: file.name }))) return;
			setDeletingPath(file.relativePath);
			setErrorMessage('');
			try {
				await window.library.delete(file.relativePath);
				setFiles((current) => current.filter((entry) => entry.relativePath !== file.relativePath));
				setPreviewFile((current) => current?.relativePath === file.relativePath ? null : current);
			} catch {
				setErrorMessage(t('settings.library.deleteError'));
			} finally {
				setDeletingPath(null);
			}
		},
		[t]
	);

	const handleContextMenu = useCallback((file: LibraryFile): void => {
		void window.win.showContextMenu([
			{ id: 'preview', label: t('settings.library.preview') },
			{ id: 'open-folder', label: t('settings.library.openFolder') },
			{ type: 'separator' },
			{ id: 'delete', label: t('settings.library.delete', { name: file.name }), enabled: deletingPath !== file.relativePath && !uploading },
		]).then((action) => {
			if (action === 'preview') setPreviewFile(file);
			else if (action === 'open-folder') void handleOpenFolder();
			else if (action === 'delete') void handleDelete(file);
		}).catch(() => setErrorMessage(t('settings.library.contextMenuError')));
	}, [deletingPath, handleDelete, handleOpenFolder, t, uploading]);

	return (
		<SettingsPageShell className="max-w-none">
			<SettingsPageHeader
				title={t('library.title')}
				description={t('settings.library.description')}
				action={
					<div className="flex flex-wrap items-center gap-2">
						<Button variant="outline" size="xs" onClick={() => void handleOpenFolder()}>
							<FolderOpen className="size-3" />
							{t('settings.library.openFolder')}
						</Button>
						<Button
							variant="outline"
							size="xs"
							onClick={() => void handleUpload()}
							disabled={loading || uploading}
						>
							<Upload className="size-3" />
							{uploading ? t('settings.library.uploading') : t('settings.library.upload')}
						</Button>
					</div>
				}
			/>

			{errorMessage && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{errorMessage}
				</SettingsNotice>
			)}

			<SettingsSection
				title={t('settings.library.files')}
				description={root || undefined}
				action={
					<ToggleGroup
						type="single"
						value={view}
						onValueChange={(value) => {
							if (value === 'collections' || value === 'list') setView(value);
						}}
						variant="outline"
						size="sm"
						aria-label={t('settings.library.view')}
					>
						<ToggleGroupItem value="collections" aria-label={t('settings.library.collections')}>
							<LayoutGrid className="size-4" />
							{t('settings.library.collections')}
						</ToggleGroupItem>
						<ToggleGroupItem value="list" aria-label={t('settings.library.list')}>
							<List className="size-4" />
							{t('settings.library.list')}
						</ToggleGroupItem>
					</ToggleGroup>
				}
			>
				<div
					role="region"
					aria-label={t('settings.library.dropZone')}
					className={cn(
						'relative rounded-xl transition-shadow',
						dragging && 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background'
					)}
					onDragEnter={(event) => {
						if (event.dataTransfer.types.includes('Files')) setDragging(true);
					}}
					onDragOver={(event) => {
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
					<SettingsPanel
						className={
							view === 'collections' && !loading && files.length > 0
								? 'border-0 bg-transparent shadow-none'
								: undefined
						}
					>
						{dragging && (
							<div className="flex items-center justify-center gap-2 border-b border-border/60 bg-muted/60 px-4 py-3 text-xs font-medium text-foreground">
								<Upload className="size-3.5" />
								{t('settings.library.drop')}
							</div>
						)}
						{loading ? (
							<SettingsLoadingRows rows={3} />
						) : files.length === 0 ? (
							<SettingsEmptyState
								icon={Library}
								title={t('library.empty')}
								description={t('settings.library.emptyDescription')}
							/>
						) : view === 'collections' ? (
							<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4">
								{files.map((file) => (
									<LibraryCard
										key={file.relativePath}
										file={file}
										disabled={deletingPath === file.relativePath || uploading}
										onDelete={(entry) => void handleDelete(entry)}
										onPreview={setPreviewFile}
										onContextMenu={handleContextMenu}
									/>
								))}
							</div>
						) : (
							files.map((file) => (
								<LibraryRow
									key={file.relativePath}
									file={file}
									disabled={deletingPath === file.relativePath || uploading}
									onDelete={(entry) => void handleDelete(entry)}
									onPreview={setPreviewFile}
									onContextMenu={handleContextMenu}
								/>
							))
						)}
					</SettingsPanel>
				</div>
			</SettingsSection>
			<LibraryModal file={previewFile} onClose={() => setPreviewFile(null)} />
		</SettingsPageShell>
	);
};

export default LibraryPage;
