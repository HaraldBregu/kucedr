const pluginSettings = jest.fn();
jest.mock('../../../../src/main/plugins/plugins_settings', () => ({ pluginSettings }));
jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => jest.requireActual('./providers').mcpProviders,
}));

import { mcpOAuthOptions } from '../../../../src/main/mcp/oauth_options';
import { findMcpService } from '../../../../src/main/mcp/manifest';

beforeEach(() => {
	pluginSettings.mockReturnValue({ client_id: 'plugin-id', client_secret: 'plugin-secret' });
});

it.each([
	'gmailmcp.googleapis.com',
	'calendarmcp.googleapis.com',
	'drivemcp.googleapis.com',
	'people.googleapis.com',
])('requires plugin credentials for %s', (host) => {
	pluginSettings.mockReturnValue({});
	expect(() => mcpOAuthOptions(`https://${host}/mcp/v1`)).toThrow('Google plugin settings');
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
])('uses the plugin credential pair and manifest scopes for %s', (host) => {
	const url = `https://${host}/mcp/v1`;
	expect(mcpOAuthOptions(url)).toMatchObject({
		clientId: 'plugin-id',
		clientSecret: 'plugin-secret',
		authorizationParams: {
			prompt: 'consent select_account',
			scope: findMcpService(url)?.scopes?.join(' '),
		},
	});
	expect(pluginSettings).toHaveBeenCalledWith('google');
});
