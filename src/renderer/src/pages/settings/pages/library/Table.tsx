import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LibraryFile } from '../../../../../../shared/library_types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LibraryRow } from './Row';
import type { LibrarySort, LibrarySortKey } from './sort';

export function LibraryTable({
	files,
	sort,
	onSort,
	onPreview,
	onContextMenu,
}: {
	readonly files: LibraryFile[];
	readonly sort: LibrarySort;
	readonly onSort: (key: LibrarySortKey) => void;
	readonly onPreview: (file: LibraryFile) => void;
	readonly onContextMenu: (file: LibraryFile) => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
	const selectedCount = files.filter((file) => selectedPaths.has(file.relativePath)).length;
	const columns: { key: LibrarySortKey; label: string; className?: string }[] = [
		{ key: 'name', label: t('settings.library.name') },
		{ key: 'size', label: t('settings.library.size'), className: 'w-28' },
		{ key: 'modified', label: t('settings.library.modified'), className: 'w-36' },
	];

	return (
		<Table className="min-w-[520px] table-fixed">
			<TableHeader>
				<TableRow>
					<TableHead className="w-12 px-3">
						<Checkbox
							checked={
								selectedCount === files.length ? true : selectedCount > 0 ? 'indeterminate' : false
							}
							onCheckedChange={(checked) =>
								setSelectedPaths((current) => {
									const next = new Set(current);
									for (const file of files) {
										if (checked === true) next.add(file.relativePath);
										else next.delete(file.relativePath);
									}
									return next;
								})
							}
							aria-label={t('settings.library.select')}
							className="border-muted-foreground/60 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=indeterminate]:border-muted-foreground/60 data-[state=indeterminate]:bg-muted"
						/>
					</TableHead>
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
								aria-sort={
									active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
								}
							>
								<Button variant="ghost" size="sm" className="-ml-2" onClick={() => onSort(key)}>
									{label}
									<SortIcon className="size-3.5" aria-hidden="true" />
								</Button>
							</TableHead>
						);
					})}
				</TableRow>
			</TableHeader>
			<TableBody>
				{files.map((file) => (
					<LibraryRow
						key={file.relativePath}
						file={file}
						selected={selectedPaths.has(file.relativePath)}
						onSelect={(selected) =>
							setSelectedPaths((current) => {
								const next = new Set(current);
								if (selected) next.add(file.relativePath);
								else next.delete(file.relativePath);
								return next;
							})
						}
						onPreview={onPreview}
						onContextMenu={onContextMenu}
					/>
				))}
			</TableBody>
		</Table>
	);
}
