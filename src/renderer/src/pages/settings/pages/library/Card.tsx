import React from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import { LibraryPreview } from './Preview';
import { formatLibraryFileSize } from './size';

export function LibraryCard({
	file,
	disabled,
	onDelete,
	onContextMenu,
}: {
	readonly file: LibraryFile;
	readonly disabled: boolean;
	readonly onDelete: (file: LibraryFile) => void;
	readonly onContextMenu: (file: LibraryFile) => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<article
			className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card p-2"
			onContextMenu={(event) => {
				event.preventDefault();
				onContextMenu(file);
			}}
		>
			<div className="w-full rounded-md text-left">
				<LibraryPreview file={file} />
			</div>
			<div className="flex min-w-0 items-start gap-2 px-1 pb-1 pt-3">
				<div className="min-w-0 flex-1 rounded-md text-left">
					<p className="truncate text-sm font-medium" title={file.name}>
						{file.name}
					</p>
					<p className="truncate text-xs text-muted-foreground" title={file.relativePath}>
						{file.relativePath}
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						<span>{file.kind === 'folder' ? '—' : formatLibraryFileSize(file.size)}</span> ·{' '}
						<time dateTime={file.modifiedAt}>{new Date(file.modifiedAt).toLocaleDateString()}</time>
					</p>
				</div>
				{file.kind !== 'folder' && (
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
				)}
			</div>
		</article>
	);
}
