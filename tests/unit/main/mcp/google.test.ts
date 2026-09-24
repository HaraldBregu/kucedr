import { googleOAuthOptions } from '../../../../src/main/mcp/google';
import { googleMcpScopes } from '../../../../src/shared/google_mcp';

const originalId = process.env.GOOGLE_CLIENT_ID;
const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

afterEach(() => {
	if (originalId === undefined) delete process.env.GOOGLE_CLIENT_ID;
	else process.env.GOOGLE_CLIENT_ID = originalId;
	if (originalSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
	else process.env.GOOGLE_CLIENT_SECRET = originalSecret;
});

it.each(['gmailmcp.googleapis.com', 'calendarmcp.googleapis.com', 'drivemcp.googleapis.com', 'people.googleapis.com'])(
	'requires environment credentials for %s',
	(host) => {
		delete process.env.GOOGLE_CLIENT_ID;
		delete process.env.GOOGLE_CLIENT_SECRET;
		expect(() => googleOAuthOptions(`https://${host}/mcp/v1`)).toThrow(
			'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'
		);
	}
);

it.each([
	['https://docsmcp.googleapis.com/mcp/v1', 'documents.readonly', 'documents'],
	['https://sheetsmcp.googleapis.com/mcp/v1', 'spreadsheets.readonly', 'spreadsheets'],
	['https://mapstools.googleapis.com/mcp', 'maps-platform.mapstools', undefined],
])('uses the documented Google scopes for %s', (url, readonlyScope, writeScope) => {
	process.env.GOOGLE_CLIENT_ID = 'environment-id';
	process.env.GOOGLE_CLIENT_SECRET = 'environment-secret';
	const scopes = googleMcpScopes(url)?.split(' ');
	expect(scopes).toContain(`https://www.googleapis.com/auth/${readonlyScope}`);
	if (writeScope) expect(scopes).toContain(`https://www.googleapis.com/auth/${writeScope}`);
	expect(googleOAuthOptions(url).authorizationParams?.scope).toBe(googleMcpScopes(url));
});

it('does not apply Maps credentials to a different path or host', () => {
	expect(googleMcpScopes('https://mapstools.googleapis.com/mcp/v1')).toBeUndefined();
	expect(googleMcpScopes('https://mapstools.googleapis.com.evil.test/mcp')).toBeUndefined();
});

it.each(['gmailmcp.googleapis.com', 'calendarmcp.googleapis.com', 'drivemcp.googleapis.com', 'people.googleapis.com'])(
	'uses the environment credential pair for %s',
	(host) => {
		process.env.GOOGLE_CLIENT_ID = 'environment-id';
		process.env.GOOGLE_CLIENT_SECRET = 'environment-secret';
		const url = `https://${host}/mcp/v1`;
		expect(googleOAuthOptions(url)).toMatchObject({
			clientId: 'environment-id',
			clientSecret: 'environment-secret',
			authorizationParams: { prompt: 'consent select_account' },
		});
	}
);
