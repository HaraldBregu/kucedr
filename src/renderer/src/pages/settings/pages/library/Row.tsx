import React from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { LibraryPreview } from './Preview';
import { formatLibraryFileSize } from './size';

export function LibraryRow({
	file,
	disabled,
	onDelete,
	onPreview,
	onContextMenu,
}: {
	readonly file: LibraryFile;
	readonly disabled: boolean;
	readonly onDelete: (file: LibraryFile) => void;
	readonly onPreview: (file: LibraryFile) => void;
	readonly onContextMenu: (file: LibraryFile) => void;
}): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<TableRow
			onContextMenu={(event) => {
				event.preventDefault();
				onContextMenu(file);
			}}
		>
			<TableCell>
				<button
					type="button"
					className="flex w-full min-w-0 items-center gap-3 text-left focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label={t('settings.library.previewFile', { name: file.name })}
					onClick={() => onPreview(file)}
				>
					<LibraryPreview file={file} compact />
					<span className="min-w-0 truncate font-medium" title={file.name}>{file.name}</span>
				</button>
			</TableCell>
			<TableCell className="max-w-0 truncate text-muted-foreground" title={file.relativePath}>
				{file.relativePath}
			</TableCell>
			<TableCell className="whitespace-nowrap text-muted-foreground">
				{formatLibraryFileSize(file.size)}
			</TableCell>
			<TableCell className="whitespace-nowrap text-muted-foreground">
				<time dateTime={file.modifiedAt}>{new Date(file.modifiedAt).toLocaleDateString()}</time>
			</TableCell>
			<TableCell className="text-right">
				<Button
					variant="ghost"
					size="icon-xs"
					className="text-muted-foreground hover:text-destructive"
					disabled={disabled}
					aria-label={t('settings.library.delete', { name: file.name })}
					onClick={() => onDelete(file)}
				>
					<Trash2 className="size-3.5" />
				</Button>
			</TableCell>
		</TableRow>
	);
}
