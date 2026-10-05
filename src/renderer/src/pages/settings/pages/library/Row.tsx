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
			className="group"
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
					className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=checked]:opacity-100"
				/>
			</TableCell>
			<TableCell>
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
			<TableCell className="whitespace-nowrap text-muted-foreground">
				{formatLibraryFileSize(file.size)}
			</TableCell>
			<TableCell className="whitespace-nowrap text-muted-foreground">
				<time dateTime={file.modifiedAt}>{new Date(file.modifiedAt).toLocaleDateString()}</time>
			</TableCell>
		</TableRow>
	);
}
