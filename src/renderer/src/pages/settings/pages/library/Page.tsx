import React, { useCallback, useEffect, useState, type DragEvent } from 'react';
import { AlertTriangle, File, FolderOpen, Library, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';
import { formatLibraryFileSize } from './size';

const LibraryPage: React.FC = () => {
	const { t } = useTranslation();
	const [files, setFiles] = useState<LibraryFile[]>([]);
	const [root, setRoot] = useState('');
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [dragging, setDragging] = useState(false);
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

	return (
		<SettingsPageShell>
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

			<SettingsSection title={t('settings.library.files')} description={root || undefined}>
				<SettingsPanel
					className={cn(
						'relative transition-shadow',
						dragging && 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background'
					)}
				>
					<div
						className="contents"
						onDragEnter={(event) => {
							if (event.dataTransfer.types.includes('Files')) setDragging(true);
						}}
						onDragOver={(event) => event.preventDefault()}
						onDragLeave={(event) => {
							if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
								setDragging(false);
							}
						}}
						onDrop={(event) => void handleDrop(event)}
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
					) : (
						files.map((file) => (
							<Item
								key={file.relativePath}
								variant="outline"
								size="md"
								className="border-b border-border/60 px-5 py-4 last:border-b-0"
							>
								<ItemMedia variant="icon">
									<File className="size-3.5" />
								</ItemMedia>
								<ItemContent className="min-w-0 flex-1 flex-col items-start gap-1">
									<ItemTitle className="max-w-full truncate">{file.name}</ItemTitle>
									<p className="max-w-full truncate text-[11px] leading-4 text-muted-foreground">
										{file.relativePath}
									</p>
								</ItemContent>
								<div className="ml-auto shrink-0 text-right text-[11px] leading-4 text-muted-foreground">
									<div>{formatLibraryFileSize(file.size)}</div>
									<time dateTime={file.modifiedAt}>
										{new Date(file.modifiedAt).toLocaleDateString()}
									</time>
								</div>
							</Item>
						))
					)}
					</div>
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default LibraryPage;
