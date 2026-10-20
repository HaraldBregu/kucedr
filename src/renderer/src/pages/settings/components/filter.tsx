import React from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

interface SettingsFilterProps {
	readonly query: string;
	readonly onQueryChange: (query: string) => void;
	readonly categories: readonly string[];
	readonly category: string;
	readonly onCategoryChange: (category: string) => void;
}

export function SettingsFilter({
	query,
	onQueryChange,
	categories,
	category,
	onCategoryChange,
}: SettingsFilterProps): React.JSX.Element {
	const { t } = useTranslation();
	const label = (value: string): string =>
		t(`settings.filter.categories.${value}`, { defaultValue: value });
	return (
		<div className="mb-3 flex items-center gap-2">
			<div className="relative flex-1">
				<Search
					className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					type="search"
					value={query}
					placeholder={t('settings.filter.search')}
					aria-label={t('settings.filter.search')}
					className="h-8 pl-8"
					onChange={(event) => onQueryChange(event.target.value)}
				/>
			</div>
			<Select value={category} onValueChange={(value) => onCategoryChange(value ?? 'all')}>
				<SelectTrigger className="w-36 shrink-0" aria-label={label('all')}>
					<SelectValue>{label(category)}</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{['all', ...categories].map((value) => (
						<SelectItem key={value} value={value}>
							{label(value)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
