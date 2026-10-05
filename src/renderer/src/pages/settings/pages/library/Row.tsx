import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { LibraryPreview } from './Preview';
import { useLibraryDrag } from './drag';
import { formatLibraryFileSize } from './size';

export function LibraryRow({
	file,
	selected,
	selectedPaths,
	onSelect,
	onMove,
	onContextMenu,
}: {
	readonly file: LibraryFile;
	readonly selected: boolean;
	readonly selectedPaths: ReadonlySet<string>;
	readonly onSelect: (selected: boolean) => void;
	readonly onMove: (paths: string[], folder: string) => void;
	readonly onContextMenu: (file: LibraryFile) => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	const { isDropTarget, ...dragProps } = useLibraryDrag(file, selectedPaths, onMove);

	return (
		<TableRow
			{...dragProps}
			draggable
			className={cn(
				'group cursor-grab data-[state=selected]:bg-transparent hover:bg-transparent active:cursor-grabbing',
				isDropTarget && 'bg-primary/10 ring-2 ring-inset ring-primary/60'
			)}
			data-drop-target={isDropTarget || undefined}
			data-state={selected ? 'selected' : undefined}
			onContextMenu={(event) => {
				event.preventDefault();
				onContextMenu(file);
			}}
		>
			<TableCell className="px-3 py-2">
				{file.kind !== 'folder' && (
					<Checkbox
						checked={selected}
						onCheckedChange={(checked) => onSelect(checked === true)}
						aria-label={t('settings.library.selectFile', { name: file.name })}
						className="border-muted-foreground/60 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
					/>
				)}
			</TableCell>
			<TableCell className={selected ? 'rounded-l-xl bg-muted/70 py-2' : 'py-2'}>
				<div className="flex w-full min-w-0 items-center gap-3 text-left">
					<LibraryPreview file={file} compact />
					<span className="min-w-0 truncate font-medium" title={file.name}>
						{file.name}
					</span>
				</div>
			</TableCell>
			<TableCell
				className={
					selected
						? 'whitespace-nowrap bg-muted/70 py-2 text-muted-foreground'
						: 'whitespace-nowrap py-2 text-muted-foreground'
				}
			>
				{file.kind === 'folder' ? '—' : formatLibraryFileSize(file.size)}
			</TableCell>
			<TableCell
				className={
					selected
						? 'rounded-r-xl whitespace-nowrap bg-muted/70 py-2 text-muted-foreground'
						: 'whitespace-nowrap py-2 text-muted-foreground'
				}
			>
				<time dateTime={file.modifiedAt}>{new Date(file.modifiedAt).toLocaleDateString()}</time>
			</TableCell>
		</TableRow>
	);
}
