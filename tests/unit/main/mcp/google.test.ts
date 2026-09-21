import { googleOAuthOptions } from '../../../../src/main/mcp/google';

const originalId = process.env.GOOGLE_CLIENT_ID;
const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

afterEach(() => {
	if (originalId === undefined) delete process.env.GOOGLE_CLIENT_ID;
	else process.env.GOOGLE_CLIENT_ID = originalId;
	if (originalSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
	else process.env.GOOGLE_CLIENT_SECRET = originalSecret;
});

it.each(['gmailmcp', 'calendarmcp', 'drivemcp'])(
	'resolves %s credentials without a development environment',
	(host) => {
		delete process.env.GOOGLE_CLIENT_ID;
		delete process.env.GOOGLE_CLIENT_SECRET;
		expect(
			googleOAuthOptions(`https://${host}.googleapis.com/mcp/v1`, {
				client_id: ' saved-id ',
				client_secret: ' saved-secret ',
			})
		).toMatchObject({ clientId: 'saved-id', clientSecret: 'saved-secret' });
	}
);

it.each(['gmailmcp', 'calendarmcp', 'drivemcp'])(
	'keeps the configured %s pair separate from environment defaults',
	(host) => {
		process.env.GOOGLE_CLIENT_ID = 'environment-id';
		process.env.GOOGLE_CLIENT_SECRET = 'environment-secret';
		const url = `https://${host}.googleapis.com/mcp/v1`;
		expect(
			googleOAuthOptions(url, { client_id: 'configured-id', client_secret: 'configured-secret' })
		).toMatchObject({ clientId: 'configured-id', clientSecret: 'configured-secret' });
		expect(googleOAuthOptions(url, { client_id: 'public-client' })).toMatchObject({
			clientId: 'public-client',
			clientSecret: undefined,
		});
		expect(googleOAuthOptions(url)).toMatchObject({
			clientId: 'environment-id',
			clientSecret: 'environment-secret',
		});
	}
);
