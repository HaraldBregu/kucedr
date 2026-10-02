import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { LibraryPreview } from './Preview';
import { formatLibraryFileSize } from './size';

export function LibraryModal({
	file,
	files,
	onClose,
	onNavigate,
}: {
	readonly file: LibraryFile | null;
	readonly files: readonly LibraryFile[];
	readonly onClose: () => void;
	readonly onNavigate: (file: LibraryFile) => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	const index = file ? files.findIndex((entry) => entry.relativePath === file.relativePath) : -1;
	const previous = index > 0 ? files[index - 1] : null;
	const next = index >= 0 && index < files.length - 1 ? files[index + 1] : null;
	return (
		<Dialog
			open={file !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			{file && (
				<DialogContent
					className="sm:max-w-5xl"
					onKeyDown={(event) => {
						if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
						if (
							(event.target as Element).closest(
								'audio, video, iframe, input, textarea, [contenteditable="true"]'
							)
						)
							return;
						event.preventDefault();
						const target = event.key === 'ArrowLeft' ? previous : next;
						if (target) onNavigate(target);
					}}
				>
					<DialogHeader className="min-w-0 pr-10">
						<DialogTitle className="truncate">{file.name}</DialogTitle>
						<DialogDescription className="truncate">
							{file.relativePath} · {formatLibraryFileSize(file.size)}
						</DialogDescription>
					</DialogHeader>
					<div
						aria-label={t('settings.library.preview')}
						className="min-w-0 overflow-hidden rounded-md"
					>
						<LibraryPreview key={file.relativePath} file={file} modal />
					</div>
					{files.length > 1 && (
						<div className="flex items-center justify-center gap-3">
							<Button
								variant="outline"
								size="icon-sm"
								aria-label={t('settings.library.previous')}
								disabled={!previous}
								onClick={() => {
									if (previous) onNavigate(previous);
								}}
							>
								<ChevronLeft className="size-4" />
							</Button>
							<span className="min-w-12 text-center text-xs text-muted-foreground">
								{index + 1} / {files.length}
							</span>
							<Button
								variant="outline"
								size="icon-sm"
								aria-label={t('settings.library.next')}
								disabled={!next}
								onClick={() => {
									if (next) onNavigate(next);
								}}
							>
								<ChevronRight className="size-4" />
							</Button>
						</div>
					)}
				</DialogContent>
			)}
		</Dialog>
	);
}
