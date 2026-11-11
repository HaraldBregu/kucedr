import React, { useRef } from 'react';
import { Search, SearchX, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { useSettingsFilter } from '../hooks/filter';
import { SettingsEmptyState } from './index';

interface SettingsFilterProps {
	readonly filter: ReturnType<typeof useSettingsFilter<unknown>>;
	readonly categoryLabels?: Readonly<Record<string, string>>;
}

export function SettingsFilter({ filter, categoryLabels }: SettingsFilterProps): React.JSX.Element {
	const { t } = useTranslation();
	const input = useRef<HTMLInputElement>(null);
	const label = (value: string): string =>
		categoryLabels?.[value] ?? t(`settings.filter.categories.${value}`, { defaultValue: value });
	return (
		<div className="flex flex-col gap-3">
			<div className="relative">
				<Search
					className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					ref={input}
					type="search"
					value={filter.query}
					placeholder={t('settings.filter.search')}
					aria-label={t('settings.filter.search')}
					className="h-9 rounded-lg pr-28 pl-9 [&::-webkit-search-cancel-button]:hidden"
					onChange={(event) => filter.setQuery(event.target.value)}
				/>
				{filter.query && (
					<div className="absolute inset-y-0 right-1.5 z-10 flex items-center gap-1.5">
						<span className="text-xs text-muted-foreground" aria-live="polite">
							{t('settings.filter.results', { count: filter.items.length })}
						</span>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label={t('settings.filter.clear')}
							onClick={() => {
								filter.setQuery('');
								input.current?.focus();
							}}
						>
							<X />
						</Button>
					</div>
				)}
			</div>
			{filter.categories.length > 1 && (
				<ToggleGroup
					type="single"
					variant="outline"
					value={filter.category}
					aria-label={t('settings.filter.filters')}
					className="flex-wrap justify-start gap-1.5"
					onValueChange={(value) => filter.setCategory(value || 'all')}
				>
					{['all', ...filter.categories].map((value) => (
						<ToggleGroupItem
							key={value}
							value={value}
							disabled={!filter.counts.get(value) && value !== filter.category}
							className="h-7 max-w-full min-w-0 gap-1.5 rounded-full px-3 text-xs text-muted-foreground data-[pressed]:border-primary data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
						>
							<span className="truncate first-letter:uppercase">{label(value)}</span>
							<span className="tabular-nums opacity-60">{filter.counts.get(value) ?? 0}</span>
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			)}
			{filter.total > 0 && filter.items.length === 0 && (
				<SettingsEmptyState
					icon={SearchX}
					title={t('settings.filter.empty')}
					description={t('settings.filter.emptyDescription')}
				>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							filter.setQuery('');
							filter.setCategory('all');
						}}
					>
						{t('settings.filter.reset')}
					</Button>
				</SettingsEmptyState>
			)}
		</div>
	);
}
