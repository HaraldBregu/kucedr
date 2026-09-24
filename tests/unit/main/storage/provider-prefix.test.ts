import { validPrefix } from '../../../../supabase/functions/_shared/prefix';

it.each(['', 'versions', 'tenant/versions', 'A_b-2.0/archive'])
	('accepts an empty or safe nested provider prefix %s', (value) => {
		expect(validPrefix(value)).toBe(true);
	});

it.each([
	'/', '/versions', 'versions/', 'tenant//versions', '.', '..',
	'./versions', 'tenant/../versions', 'tenant/./versions',
	'versions\\private', 'versions?token=secret', 'a'.repeat(513),
])('rejects an unsafe provider prefix %s', (value) => {
	expect(validPrefix(value)).toBe(false);
});
