import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { LibraryPreview } from './Preview';
import { useLibraryDrag } from './drag';
import { formatLibraryFileSize } from './size';

export function LibraryRow({
	file,
	selected,
	editing,
	selectedPaths,
	onSelect,
	onOpenFolder,
	onMove,
	onContextMenu,
	onDelete,
}: {
	readonly file: LibraryFile;
	readonly selected: boolean;
	readonly editing: boolean;
	readonly selectedPaths: ReadonlySet<string>;
	readonly onSelect: (selected: boolean) => void;
	readonly onOpenFolder: (file: LibraryFile) => void;
	readonly onMove: (paths: string[], folder: string) => void;
	readonly onContextMenu: (file: LibraryFile) => void;
	readonly onDelete: (file: LibraryFile) => void;
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
			{editing && <TableCell className="px-3 py-2">
				{file.kind !== 'folder' && (
					<Checkbox
						checked={selected}
						onCheckedChange={(checked) => onSelect(checked === true)}
						aria-label={t('settings.library.selectFile', { name: file.name })}
						className="border-muted-foreground/60 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
					/>
				)}
			</TableCell>}
			<TableCell className="py-2">
				{file.kind === 'folder' ? (
					<button
						type="button"
						className="flex w-full min-w-0 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => onOpenFolder(file)}
						aria-label={t('settings.library.openFolderNamed', { name: file.name })}
					>
						<span className="size-9 shrink-0 [&>*]:size-9 [&>*]:rounded-sm [&>*]:bg-muted"><LibraryPreview file={file} compact /></span>
						<div className="flex min-w-0 flex-col">
							<span className="truncate text-sm font-medium" title={file.name}>
								{file.name}
							</span>
						</div>
					</button>
				) : (
					<div className="flex w-full min-w-0 items-center gap-3 text-left">
						<span className="size-9 shrink-0 [&>*]:size-9 [&>*]:rounded-sm [&>*]:bg-muted"><LibraryPreview file={file} compact /></span>
						<div className="flex min-w-0 flex-col">
							<span className="truncate text-sm font-medium" title={file.name}>
								{file.name}
							</span>
						</div>
					</div>
				)}
			</TableCell>
			<TableCell className="whitespace-nowrap py-2 text-sm text-muted-foreground">
				{file.kind === 'folder' ? '—' : formatLibraryFileSize(file.size)}
			</TableCell>
			<TableCell className="whitespace-nowrap py-2 text-sm text-muted-foreground">
				<time dateTime={file.modifiedAt}>{new Date(file.modifiedAt).toLocaleDateString()}</time>
			</TableCell>
			<TableCell className="py-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t('settings.library.actions', 'Actions')}>
							<MoreHorizontal />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => void navigator.clipboard.writeText(file.path)}>
							{t('settings.library.copyPath', 'Copy path')}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(file)}>
							{t('settings.library.deleteAction', 'Delete')}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</TableCell>
		</TableRow>
	);
}
