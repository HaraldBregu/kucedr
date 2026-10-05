import React from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LibraryPreview } from './Preview';
import { useLibraryDrag } from './drag';
import { formatLibraryFileSize } from './size';

export function LibraryCard({
	file,
	selectedPaths,
	disabled,
	onDelete,
	onOpenFolder,
	onMove,
	onContextMenu,
}: {
	readonly file: LibraryFile;
	readonly selectedPaths: ReadonlySet<string>;
	readonly disabled: boolean;
	readonly onDelete: (file: LibraryFile) => void;
	readonly onOpenFolder: (file: LibraryFile) => void;
	readonly onMove: (paths: string[], folder: string) => void;
	readonly onContextMenu: (file: LibraryFile) => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	const { isDropTarget, ...dragProps } = useLibraryDrag(file, selectedPaths, onMove);
	return (
		<article
			{...dragProps}
			draggable
			className={cn(
				'min-w-0 cursor-grab overflow-hidden rounded-xl border border-border/70 bg-card p-2 active:cursor-grabbing',
				isDropTarget && 'bg-primary/10 ring-2 ring-primary/60'
			)}
			data-drop-target={isDropTarget || undefined}
			onContextMenu={(event) => {
				event.preventDefault();
				onContextMenu(file);
			}}
		>
			{file.kind === 'folder' ? (
				<button
					type="button"
					className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={() => onOpenFolder(file)}
					aria-label={t('settings.library.openFolderNamed', { name: file.name })}
				>
					<LibraryPreview file={file} />
				</button>
			) : (
				<div className="w-full rounded-md text-left">
					<LibraryPreview file={file} />
				</div>
			)}
			<div className="flex min-w-0 items-start gap-2 px-1 pb-1 pt-3">
				<div className="min-w-0 flex-1 rounded-md text-left">
					<p className="truncate text-sm font-medium" title={file.name}>
						{file.kind === 'folder' ? (
							<button
								type="button"
								className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={() => onOpenFolder(file)}
								aria-label={t('settings.library.openFolderNamed', { name: file.name })}
							>
								{file.name}
							</button>
						) : (
							file.name
						)}
					</p>
					<p className="truncate text-xs text-muted-foreground" title={file.relativePath}>
						{file.relativePath}
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						<span>{file.kind === 'folder' ? '—' : formatLibraryFileSize(file.size)}</span> ·{' '}
						<time dateTime={file.modifiedAt}>{new Date(file.modifiedAt).toLocaleDateString()}</time>
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					className="shrink-0 text-muted-foreground hover:text-destructive"
					disabled={disabled}
					aria-label={t('settings.library.delete', { name: file.name })}
					onClick={() => onDelete(file)}
				>
					<Trash2 className="size-3.5" />
				</Button>
			</div>
		</article>
	);
}
