import React from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
	return (
		<div className="mb-3 flex flex-col gap-2">
			<div className="relative">
				<Search
					className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					type="search"
					value={query}
					placeholder={t('settings.filter.search')}
					aria-label={t('settings.filter.search')}
					className="pl-8"
					onChange={(event) => onQueryChange(event.target.value)}
				/>
			</div>
			<ToggleGroup
				type="single"
				value={category}
				className="flex-wrap justify-start gap-1"
				onValueChange={(value) => onCategoryChange(value || 'all')}
			>
				{['all', ...categories].map((value) => (
					<ToggleGroupItem
						key={value}
						value={value}
						variant="outline"
						size="sm"
						className="px-3 text-xs"
					>
						{t(`settings.filter.categories.${value}`, { defaultValue: value })}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}
