import { endpoint } from '../../../../supabase/functions/_shared/endpoint';

it('normalizes an HTTPS S3-compatible endpoint', () => {
	expect(endpoint('https://objects.example.com/')).toBe('https://objects.example.com');
	expect(endpoint(undefined)).toBeNull();
});

it.each([
	'http://objects.example.com',
	'https://user:pass@objects.example.com',
	'https://objects.example.com/?token=secret',
	'https://127.0.0.1',
	'https://169.254.169.254',
	'https://localhost',
	'https://internal.local',
])('rejects unsafe provider endpoint %s', (value) => {
	expect(() => endpoint(value)).toThrow('Invalid S3 endpoint');
});
