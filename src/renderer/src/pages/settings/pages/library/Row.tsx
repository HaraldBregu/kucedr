import React from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { LibraryPreview } from './Preview';
import { formatLibraryFileSize } from './size';

export function LibraryRow({
	file,
	disabled,
	onDelete,
}: {
	readonly file: LibraryFile;
	readonly disabled: boolean;
	readonly onDelete: (file: LibraryFile) => void;
}): React.JSX.Element {
	const { t } = useTranslation();

	return (
		<Item
			variant="outline"
			size="md"
			className="flex-nowrap border-b border-border/60 px-5 py-4 last:border-b-0"
		>
			<ItemMedia variant="icon" className="h-auto w-auto bg-transparent">
				<LibraryPreview file={file} compact />
			</ItemMedia>
			<ItemContent className="min-w-0 flex-1 flex-col items-start gap-1">
				<ItemTitle className="max-w-full truncate">{file.name}</ItemTitle>
				<p className="max-w-full truncate text-[11px] leading-4 text-muted-foreground">
					{file.relativePath}
				</p>
			</ItemContent>
			<div className="ml-auto shrink-0 text-right text-[11px] leading-4 text-muted-foreground">
				<div>{formatLibraryFileSize(file.size)}</div>
				<time dateTime={file.modifiedAt}>{new Date(file.modifiedAt).toLocaleDateString()}</time>
			</div>
			<ItemActions className="flex-none justify-end">
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
			</ItemActions>
		</Item>
	);
}
