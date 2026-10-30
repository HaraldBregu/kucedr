import React from 'react';
import { FileAudio, FileImage, FileText, FileVideo, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';

export const LIBRARY_FILTERS = [
	{ value: 'all', label: 'All', icons: [] },
	{ value: 'images', label: 'Images', icons: [FileImage] },
	{ value: 'documents', label: 'Documents', icons: [FileText] },
	{ value: 'media', label: 'Media', icons: [FileAudio, FileVideo] },
] as const;

export type LibraryFilterValue = (typeof LIBRARY_FILTERS)[number]['value'];

export function LibraryFilter({
	filter,
	onFilterChange,
	query,
	onQueryChange,
}: {
	readonly filter: LibraryFilterValue;
	readonly onFilterChange: (filter: LibraryFilterValue) => void;
	readonly query: string;
	readonly onQueryChange: (query: string) => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<div className="flex flex-wrap items-center gap-2">
			<ButtonGroup aria-label={t('settings.library.filter', 'Filter')}>
				{LIBRARY_FILTERS.map(({ value, label }) => (
					<Button
						key={value}
						type="button"
						variant={filter === value ? 'secondary' : 'outline'}
						size="sm"
						aria-pressed={filter === value}
						onClick={() => onFilterChange(value)}
					>
						{t(`settings.library.filters.${value}`, label)}
					</Button>
				))}
			</ButtonGroup>
			<div className="relative ml-auto w-full max-w-64">
				<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder={t('settings.library.search', 'Search files')}
					aria-label={t('settings.library.search', 'Search files')}
					className="h-8 pl-8"
				/>
			</div>
		</div>
	);
}
