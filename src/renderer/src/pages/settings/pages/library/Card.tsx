import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { cn } from '@/lib/utils';
import { LibraryPreview } from './Preview';
import { useLibraryDrag } from './drag';

export function LibraryCard({
	file,
	selectedPaths,
	onOpenFolder,
	onMove,
	onContextMenu,
}: {
	readonly file: LibraryFile;
	readonly selectedPaths: ReadonlySet<string>;
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
				'cursor-grab rounded-md active:cursor-grabbing',
				isDropTarget && 'ring-2 ring-primary/60'
			)}
			aria-label={file.name}
			tabIndex={file.kind === 'folder' ? undefined : 0}
			data-drop-target={isDropTarget || undefined}
			onContextMenu={(event) => {
				event.preventDefault();
				onContextMenu(file);
			}}
			onKeyDown={(event) => {
				if (
					event.target === event.currentTarget &&
					(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
				) {
					event.preventDefault();
					onContextMenu(file);
				}
			}}
		>
			{file.kind === 'folder' ? (
				<button
					type="button"
					className="rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={() => onOpenFolder(file)}
					aria-label={t('settings.library.openFolderNamed', { name: file.name })}
				>
					<LibraryPreview file={file} tile />
				</button>
			) : (
				<div className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
					<LibraryPreview file={file} tile />
				</div>
			)}
		</article>
	);
}
