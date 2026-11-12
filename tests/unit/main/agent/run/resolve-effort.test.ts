import { resolveModelEffort } from '../../../src/shared/resolve_effort';

it('preserves the previous nearest effort for existing levels', () => {
	expect(resolveModelEffort('minimal', ['none', 'low'])).toBe('none');
});

it('accepts instant and maps it to the closest available effort', () => {
	expect(resolveModelEffort('instant', ['instant', 'low'])).toBe('instant');
	expect(resolveModelEffort('instant', ['low', 'medium'])).toBe('low');
});
