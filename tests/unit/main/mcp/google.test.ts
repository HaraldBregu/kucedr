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
	'requires environment credentials for %s',
	(host) => {
		delete process.env.GOOGLE_CLIENT_ID;
		delete process.env.GOOGLE_CLIENT_SECRET;
		expect(() => googleOAuthOptions(`https://${host}.googleapis.com/mcp/v1`)).toThrow(
			'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'
		);
	}
);

it.each(['gmailmcp', 'calendarmcp', 'drivemcp'])(
	'uses the environment credential pair for %s',
	(host) => {
		process.env.GOOGLE_CLIENT_ID = 'environment-id';
		process.env.GOOGLE_CLIENT_SECRET = 'environment-secret';
		const url = `https://${host}.googleapis.com/mcp/v1`;
		expect(googleOAuthOptions(url)).toMatchObject({
			clientId: 'environment-id',
			clientSecret: 'environment-secret',
			authorizationParams: { prompt: 'consent select_account' },
		});
	}
);
