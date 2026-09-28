import { mcpOAuthOptions } from '../../../../src/main/mcp/oauth_options';
import { findMcpService } from '../../../../src/main/mcp/manifest';

const originalId = process.env.GOOGLE_CLIENT_ID;
const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

afterEach(() => {
	if (originalId === undefined) delete process.env.GOOGLE_CLIENT_ID;
	else process.env.GOOGLE_CLIENT_ID = originalId;
	if (originalSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
	else process.env.GOOGLE_CLIENT_SECRET = originalSecret;
});

it.each([
	'gmailmcp.googleapis.com',
	'calendarmcp.googleapis.com',
	'drivemcp.googleapis.com',
	'people.googleapis.com',
])('requires environment credentials for %s', (host) => {
	delete process.env.GOOGLE_CLIENT_ID;
	delete process.env.GOOGLE_CLIENT_SECRET;
	expect(() => mcpOAuthOptions(`https://${host}/mcp/v1`)).toThrow(
		'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'
	);
});

it.each([
	['https://docsmcp.googleapis.com/mcp/v1', 'documents.readonly', 'documents'],
	['https://sheetsmcp.googleapis.com/mcp/v1', 'spreadsheets.readonly', 'spreadsheets'],
	['https://mapstools.googleapis.com/mcp', 'maps-platform.mapstools', undefined],
])('uses the documented Google scopes for %s', (url, readonlyScope, writeScope) => {
	process.env.GOOGLE_CLIENT_ID = 'environment-id';
	process.env.GOOGLE_CLIENT_SECRET = 'environment-secret';
	const scopes = findMcpService(url)?.scopes;
	expect(scopes).toContain(`https://www.googleapis.com/auth/${readonlyScope}`);
	if (writeScope) expect(scopes).toContain(`https://www.googleapis.com/auth/${writeScope}`);
	expect(mcpOAuthOptions(url).authorizationParams?.scope).toBe(scopes?.join(' '));
});

it('requests full Drive access for all Drive MCP tools', () => {
	const url = 'https://drivemcp.googleapis.com/mcp/v1';
	expect(findMcpService(url)?.scopes).toEqual(['https://www.googleapis.com/auth/drive']);
	process.env.GOOGLE_CLIENT_ID = 'environment-id';
	process.env.GOOGLE_CLIENT_SECRET = 'environment-secret';
	expect(mcpOAuthOptions(url).authorizationParams?.scope).toBe('https://www.googleapis.com/auth/drive');
});

it('requests the scope needed for all Gmail MCP tools', () => {
	const scopes = findMcpService('https://gmailmcp.googleapis.com/mcp/v1')?.scopes;
	expect(scopes).toEqual(['https://www.googleapis.com/auth/gmail.modify']);
});

it('requests full Calendar access for Calendar MCP', () => {
	const url = 'https://calendarmcp.googleapis.com/mcp/v1';
	expect(findMcpService(url)?.scopes).toEqual(['https://www.googleapis.com/auth/calendar']);
	process.env.GOOGLE_CLIENT_ID = 'environment-id';
	process.env.GOOGLE_CLIENT_SECRET = 'environment-secret';
	expect(mcpOAuthOptions(url).authorizationParams?.scope).toBe(
		'https://www.googleapis.com/auth/calendar'
	);
});

it('requests GitLab MCP scope from its manifest', () => {
	expect(mcpOAuthOptions('https://gitlab.com/api/v4/mcp').authorizationParams?.scope).toBe('mcp');
	expect(mcpOAuthOptions('https://mcp.notion.com/mcp')).toEqual({});
});

it('does not apply Maps credentials to a different path or host', () => {
	expect(findMcpService('https://mapstools.googleapis.com/mcp/v1')).toBeUndefined();
	expect(findMcpService('https://mapstools.googleapis.com.evil.test/mcp')).toBeUndefined();
});

it.each([
	'gmailmcp.googleapis.com',
	'calendarmcp.googleapis.com',
	'drivemcp.googleapis.com',
	'people.googleapis.com',
])('uses the environment credential pair for %s', (host) => {
	process.env.GOOGLE_CLIENT_ID = 'environment-id';
	process.env.GOOGLE_CLIENT_SECRET = 'environment-secret';
	const url = `https://${host}/mcp/v1`;
	expect(mcpOAuthOptions(url)).toMatchObject({
		clientId: 'environment-id',
		clientSecret: 'environment-secret',
		authorizationParams: { prompt: 'consent select_account' },
	});
});
