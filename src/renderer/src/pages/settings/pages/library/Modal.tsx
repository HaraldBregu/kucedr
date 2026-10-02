import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LibraryPreview } from './Preview';
import { formatLibraryFileSize } from './size';

export function LibraryModal({ file, onClose }: {
	readonly file: LibraryFile | null;
	readonly onClose: () => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<Dialog open={file !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
			{file && <DialogContent className="sm:max-w-5xl">
				<DialogHeader className="min-w-0 pr-10">
					<DialogTitle className="truncate">{file.name}</DialogTitle>
					<DialogDescription className="truncate">{file.relativePath} · {formatLibraryFileSize(file.size)}</DialogDescription>
				</DialogHeader>
				<div aria-label={t('settings.library.preview')} className="min-w-0 overflow-hidden rounded-md">
					<LibraryPreview file={file} modal />
				</div>
			</DialogContent>}
		</Dialog>
	);
}
