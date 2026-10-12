import { loadCloudConfig } from '../../../../src/main/cloud/config';

const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

beforeEach(() => {
	delete process.env.SUPABASE_URL;
	delete process.env.SUPABASE_PUBLISHABLE_KEY;
});

afterAll(() => {
	if (originalUrl === undefined) delete process.env.SUPABASE_URL;
	else process.env.SUPABASE_URL = originalUrl;
	if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
	else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
});

it('accepts a publishable key over HTTPS', () => {
	process.env.SUPABASE_URL = 'https://project.example/';
	process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

	expect(loadCloudConfig()).toEqual({
		url: 'https://project.example',
		publishableKey: 'sb_publishable_test',
		redirectUrl: 'kucedr://auth/callback',
	});
});

it('accepts a legacy anon JWT over HTTP loopback', () => {
	process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
	process.env.SUPABASE_PUBLISHABLE_KEY = `header.${Buffer.from(
		JSON.stringify({ role: 'anon' })
	).toString('base64url')}.signature`;

	expect(loadCloudConfig()).toMatchObject({ url: 'http://127.0.0.1:54321' });
});

it.each([
	'http://project.example',
	'ftp://127.0.0.1',
	'https://user:password@project.example',
	'https://project.example/auth',
])('rejects an unsafe cloud URL: %s', (url) => {
	process.env.SUPABASE_URL = url;
	process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

	expect(loadCloudConfig()).toBeNull();
});

it.each([
	'sb_secret_test',
	'arbitrary-key',
	`header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`,
])('rejects a non-publishable cloud key', (publishableKey) => {
	process.env.SUPABASE_URL = 'https://project.example';
	process.env.SUPABASE_PUBLISHABLE_KEY = publishableKey;

	expect(loadCloudConfig()).toBeNull();
});
