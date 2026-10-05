import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { LibraryPreview } from './Preview';
import { formatLibraryFileSize } from './size';

export function LibraryRow({
	file,
	selected,
	onSelect,
	onPreview,
	onContextMenu,
}: {
	readonly file: LibraryFile;
	readonly selected: boolean;
	readonly onSelect: (selected: boolean) => void;
	readonly onPreview: (file: LibraryFile) => void;
	readonly onContextMenu: (file: LibraryFile) => void;
}): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<TableRow
			className="group data-[state=selected]:bg-transparent hover:bg-transparent"
			data-state={selected ? 'selected' : undefined}
			onContextMenu={(event) => {
				event.preventDefault();
				onContextMenu(file);
			}}
		>
			<TableCell className="px-3">
				<Checkbox
					checked={selected}
					onCheckedChange={(checked) => onSelect(checked === true)}
					aria-label={t('settings.library.selectFile', { name: file.name })}
					className="border-muted-foreground/60 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
				/>
			</TableCell>
			<TableCell className={selected ? 'rounded-l-xl bg-muted/70' : undefined}>
				<button
					type="button"
					className="flex w-full min-w-0 items-center gap-3 text-left focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label={t('settings.library.previewFile', { name: file.name })}
					onClick={() => onPreview(file)}
				>
					<LibraryPreview file={file} compact />
					<span className="min-w-0 truncate font-medium" title={file.name}>
						{file.name}
					</span>
				</button>
			</TableCell>
			<TableCell
				className={
					selected
						? 'whitespace-nowrap bg-muted/70 text-muted-foreground'
						: 'whitespace-nowrap text-muted-foreground'
				}
			>
				{formatLibraryFileSize(file.size)}
			</TableCell>
			<TableCell
				className={
					selected
						? 'rounded-r-xl whitespace-nowrap bg-muted/70 text-muted-foreground'
						: 'whitespace-nowrap text-muted-foreground'
				}
			>
				<time dateTime={file.modifiedAt}>{new Date(file.modifiedAt).toLocaleDateString()}</time>
			</TableCell>
		</TableRow>
	);
}
