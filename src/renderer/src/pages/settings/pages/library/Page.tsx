import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, File, FolderOpen, Library, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
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
						<Button variant="outline" size="xs" onClick={loadFiles} disabled={loading}>
							<RefreshCw className="size-3" />
							{t('settings.library.refresh')}
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
				<SettingsPanel>
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
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default LibraryPage;
