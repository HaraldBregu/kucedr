import { useState } from 'react';

interface SettingsFilterOptions<T> {
	readonly text: (item: T) => string;
	readonly category: (item: T) => string | readonly string[];
	readonly order?: readonly string[];
}

export function useSettingsFilter<T>(
	items: readonly T[],
	{ text, category, order = [] }: SettingsFilterOptions<T>
) {
	const [query, setQuery] = useState('');
	const [selected, setCategory] = useState('all');
	const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
	const matches = items.filter((item) => {
		const haystack = text(item).toLocaleLowerCase();
		return terms.every((term) => haystack.includes(term));
	});
	const rank = (value: string): number => order.indexOf(value) + 1 || order.length + 1;
	const categories = [...new Set(items.flatMap(category))].sort(
		(a, b) => rank(a) - rank(b) || a.localeCompare(b)
	);
	const active = categories.includes(selected) ? selected : 'all';
	const counts = new Map([['all', matches.length]]);
	for (const value of matches.flatMap(category)) counts.set(value, (counts.get(value) ?? 0) + 1);
	return {
		items:
			active === 'all'
				? matches
				: matches.filter((item) => [category(item)].flat().includes(active)),
		total: items.length,
		query,
		setQuery,
		category: active,
		setCategory,
		categories,
		counts,
	};
}
