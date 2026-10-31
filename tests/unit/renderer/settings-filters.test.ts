import { createFilterQuery, createFilterRule } from '@/components/reui/filters/filters-query';
import { matches } from '@/pages/settings/components/matches';

describe('settings filters', () => {
	const rule = (path: string, operator: string, value?: unknown) =>
		createFilterRule({ path: [path], operator, value });

	it('combines case-insensitive search and category rules', () => {
		const query = createFilterQuery([
			rule('search', 'contains', 'GITHUB'),
			rule('category', 'is_any_of', ['remote', 'plugin']),
		]);
		expect(matches(query, 'GitHub server', 'remote')).toBe(true);
		expect(matches(query, 'GitHub server', 'local')).toBe(false);
		expect(matches(query, 'Other server', 'remote')).toBe(false);
	});

	it('supports inverse, exact and negated rules', () => {
		expect(matches(createFilterQuery([rule('category', 'is_none_of', ['remote'])]), 'x', 'local')).toBe(true);
		expect(matches(createFilterQuery([rule('search', 'starts_with', 'git')]), 'GitHub', 'local')).toBe(true);
		expect(matches(createFilterQuery([{ ...rule('search', 'ends_with', 'hub'), negated: true }]), 'GitHub', 'local')).toBe(false);
		expect(matches(createFilterQuery([rule('category', 'is_not', 'remote')]), 'x', 'remote')).toBe(false);
	});

	it('handles empty and incomplete rules', () => {
		expect(matches(createFilterQuery(), 'x', 'local')).toBe(true);
		expect(matches(createFilterQuery([rule('search', 'is')]), 'x', 'local')).toBe(true);
		expect(matches(createFilterQuery([rule('search', 'empty')]), '', 'local')).toBe(true);
		expect(matches(createFilterQuery([rule('search', 'not_empty')]), '', 'local')).toBe(false);
	});
});
