import { flattenFilterRules } from '@/components/reui/filters/filters-query';
import type { FilterQuery } from '@/components/reui/filters/filters-types';

export function matches(query: FilterQuery, search: string, category: string): boolean {
	return flattenFilterRules(query).every((rule) => {
		const actual = (rule.path[0] === 'category' ? category : search).toLowerCase();
		const values = (Array.isArray(rule.value) ? rule.value : [rule.value])
			.filter((value): value is string => typeof value === 'string')
			.map((value) => value.toLowerCase());
		const value = values[0] ?? '';
		if (rule.operator !== 'empty' && rule.operator !== 'not_empty' && values.length === 0) return true;
		let result: boolean;
		switch (rule.operator) {
			case 'contains': result = actual.includes(value); break;
			case 'not_contains': result = !actual.includes(value); break;
			case 'starts_with': result = actual.startsWith(value); break;
			case 'ends_with': result = actual.endsWith(value); break;
			case 'is': result = actual === value; break;
			case 'is_not': result = actual !== value; break;
			case 'is_any_of': result = values.includes(actual); break;
			case 'is_none_of': result = !values.includes(actual); break;
			case 'empty': result = actual.trim().length === 0; break;
			case 'not_empty': result = actual.trim().length > 0; break;
			default: return true;
		}
		return rule.negated ? !result : result;
	});
}
