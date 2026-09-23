import { countMatches } from '../../../resources/apps/workspace/src/lib/matches';

describe('countMatches', () => {
	it('counts non-overlapping matches without case sensitivity', () => {
		expect(countMatches('JSON json Json', 'json')).toBe(3);
	});

	it('returns zero for an empty query', () => {
		expect(countMatches('JSON', '')).toBe(0);
	});
});
