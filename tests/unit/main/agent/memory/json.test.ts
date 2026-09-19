import { normalizeJson } from '../../../../../src/main/memory/json';

it('normalizes plain and fenced JSON while rejecting empty output', () => {
	expect(normalizeJson('{"entries":[]}')).toBe('{"entries":[]}');
	expect(normalizeJson('```json\n{"entries":[]}\n```')).toBe('{"entries":[]}');
	expect(() => normalizeJson('')).toThrow();
});
