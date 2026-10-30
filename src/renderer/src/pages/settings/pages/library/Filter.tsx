import React from 'react';
import { Check, FileAudio, FileCode2, FileImage, FileSpreadsheet, FileText, FileVideo, ListFilter, Search, Shapes, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

export const LIBRARY_FILTERS = [
	{ value: 'all', label: 'All', icon: Shapes, icons: [] },
	{ value: 'images', label: 'Images', icon: FileImage, icons: [FileImage] },
	{ value: 'documents', label: 'Documents', icon: FileText, icons: [FileText, FileSpreadsheet, FileCode2] },
	{ value: 'media', label: 'Media', icon: FileVideo, icons: [FileAudio, FileVideo] },
] as const;

export type LibraryFilterValue = (typeof LIBRARY_FILTERS)[number]['value'];

export function LibraryFilter({
	filter,
	onFilterChange,
	query,
	onQueryChange,
	actions,
}: {
	readonly filter: LibraryFilterValue;
	readonly onFilterChange: (filter: LibraryFilterValue) => void;
	readonly query: string;
	readonly onQueryChange: (query: string) => void;
	readonly actions: React.ReactNode;
}): React.JSX.Element {
	const { t } = useTranslation();
	const active = LIBRARY_FILTERS.find((entry) => entry.value === filter);
	const typeLabel = t('settings.library.type', 'Type');
	const options = (
		<DropdownMenuContent align="start" className="w-48">
			<DropdownMenuLabel className="text-xs text-muted-foreground">{typeLabel}</DropdownMenuLabel>
			{LIBRARY_FILTERS.filter((entry) => entry.value !== 'all').map(({ value, label, icon: Icon }) => (
				<DropdownMenuItem key={value} onSelect={() => onFilterChange(value)}>
					<Icon className="text-muted-foreground" />
					<span className="flex-1">{t(`settings.library.filters.${value}`, label)}</span>
					{filter === value && <Check />}
				</DropdownMenuItem>
			))}
		</DropdownMenuContent>
	);
	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="relative w-full max-w-64">
				<Search className="pointer-events-none absolute z-10 left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder={t('settings.library.search', 'Search files')}
					aria-label={t('settings.library.search', 'Search files')}
					className="h-8 pl-8"
				/>
			</div>
			<div className="flex-1" />
			{active && active.value !== 'all' ? (
				<ButtonGroup aria-label={typeLabel}>
					<Button type="button" variant="outline" size="sm" className="pointer-events-none gap-1.5 text-muted-foreground">
						<Shapes className="size-3.5" />
						{typeLabel}
					</Button>
					<Button type="button" variant="outline" size="sm" className="pointer-events-none text-muted-foreground">
						{t('settings.library.is', 'is')}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="outline" size="sm" className="gap-1.5">
								<active.icon className="size-3.5" />
								{t(`settings.library.filters.${active.value}`, active.label)}
							</Button>
						</DropdownMenuTrigger>
						{options}
					</DropdownMenu>
					<Button type="button" variant="outline" size="icon-sm" aria-label={t('settings.library.clearFilter', 'Remove filter')} onClick={() => onFilterChange('all')}>
						<X className="size-3.5" />
					</Button>
				</ButtonGroup>
			) : (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button type="button" variant="outline" size="sm" className="gap-1.5">
							<ListFilter className="size-3.5" />
							{t('settings.library.addFilter', 'Filter')}
						</Button>
					</DropdownMenuTrigger>
					{options}
				</DropdownMenu>
			)}
			{actions}
		</div>
	);
}
