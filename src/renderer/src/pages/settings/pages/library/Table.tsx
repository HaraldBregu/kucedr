import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LibraryRow } from './Row';
import type { LibrarySort, LibrarySortKey } from './sort';

export function LibraryTable({
	files,
	sort,
	onSort,
	deletingPath,
	uploading,
	onDelete,
	onPreview,
	onContextMenu,
}: {
	readonly files: LibraryFile[];
	readonly sort: LibrarySort;
	readonly onSort: (key: LibrarySortKey) => void;
	readonly deletingPath: string | null;
	readonly uploading: boolean;
	readonly onDelete: (file: LibraryFile) => void;
	readonly onPreview: (file: LibraryFile) => void;
	readonly onContextMenu: (file: LibraryFile) => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	const columns: { key: LibrarySortKey; label: string; className?: string }[] = [
		{ key: 'name', label: t('settings.library.name'), className: 'w-[32%]' },
		{ key: 'path', label: t('settings.library.path') },
		{ key: 'size', label: t('settings.library.size'), className: 'w-28' },
		{ key: 'modified', label: t('settings.library.modified'), className: 'w-36' },
	];

	return (
		<Table className="min-w-[720px] table-fixed">
			<TableHeader>
				<TableRow>
					{columns.map(({ key, label, className }) => {
						const active = sort.key === key;
						const SortIcon = active
							? sort.direction === 'asc'
								? ArrowUp
								: ArrowDown
							: ArrowUpDown;
						return (
							<TableHead
								key={key}
								className={className}
								aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
							>
								<Button variant="ghost" size="sm" className="-ml-2" onClick={() => onSort(key)}>
									{label}
									<SortIcon className="size-3.5" aria-hidden="true" />
								</Button>
							</TableHead>
						);
					})}
					<TableHead className="w-16 text-right">{t('settings.library.actions')}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{files.map((file) => (
					<LibraryRow
						key={file.relativePath}
						file={file}
						disabled={deletingPath === file.relativePath || uploading}
						onDelete={onDelete}
						onPreview={onPreview}
						onContextMenu={onContextMenu}
					/>
				))}
			</TableBody>
		</Table>
	);
}
