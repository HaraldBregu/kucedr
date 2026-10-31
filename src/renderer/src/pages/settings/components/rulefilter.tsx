import React from 'react';
import { ListFilter, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Filters } from '@/components/reui/filters/filters';
import type { FilterField, FilterQuery } from '@/components/reui/filters/filters-types';

interface RuleFilterProps {
	query: FilterQuery;
	onQueryChange: (query: FilterQuery) => void;
	categories: readonly string[];
}

export function RuleFilter({ query, onQueryChange, categories }: RuleFilterProps): React.JSX.Element {
	const { t } = useTranslation();
	const fields: FilterField[] = [
		{ id: 'search', label: t('settings.filter.search'), type: 'text', icon: <Type /> },
		{
			id: 'category',
			label: 'Category',
			type: 'select',
			icon: <ListFilter />,
			options: categories.map((value) => ({
				value,
				label: t(`settings.filter.categories.${value}`, { defaultValue: value }),
			})),
		},
	];
	return <Filters className="mb-3" size="sm" fields={fields} query={query} onQueryChange={onQueryChange} showClear />;
}
