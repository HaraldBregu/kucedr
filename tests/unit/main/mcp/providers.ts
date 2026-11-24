const googleOauth = {
	client_id_setting: 'client_id',
	client_secret_setting: 'client_secret',
	authorization_params: { access_type: 'offline', prompt: 'consent select_account' },
	google_fetch: true,
};

export const mcpProviders = [
	{
		directory: '/plugins/google',
		plugin: { id: 'google', name: 'Google' },
		manifest: {
			providerId: 'google',
			providerName: 'Google',
			mcp_servers: [
				['gmail', 'gmailmcp', 'gmail.readonly'],
				['google-calendar', 'calendarmcp', 'calendar'],
				['google-drive', 'drivemcp', 'drive'],
				['google-contacts', 'people', 'contacts'],
			].map(([id, host, scope]) => ({
				id,
				name: id,
				authentication: 'oauth2',
				url: `https://${host}.googleapis.com/mcp/v1`,
				scopes: [`https://www.googleapis.com/auth/${scope}`],
				oauth: googleOauth,
			})),
		},
	},
	{
		directory: '/plugins/microsoft',
		plugin: { id: 'microsoft', name: 'Microsoft' },
		manifest: {
			providerId: 'microsoft',
			providerName: 'Microsoft',
			mcp_servers: [
				{
					id: 'microsoft-learn',
					name: 'Microsoft Learn',
					authentication: 'none',
					url: 'https://learn.microsoft.com/api/mcp',
					scopes: [],
				},
				{
					id: 'microsoft-mail',
					name: 'Outlook Mail',
					authentication: 'oauth2',
					url: 'https://agent365.svc.cloud.microsoft/agents/tenants/{tenantId}/servers/mcp_MailTools',
					scopes: [],
					oauth: { client_id_setting: 'client_id' },
				},
			],
		},
	},
	{
		directory: '/plugins/github',
		plugin: { id: 'github', name: 'GitHub' },
		manifest: {
			providerId: 'github',
			providerName: 'GitHub',
			mcp_servers: [
				{
					id: 'github',
					name: 'GitHub',
					authentication: 'oauth2',
					url: 'https://api.githubcopilot.com/mcp/',
					scopes: [],
					oauth: { credentials_required: true },
				},
			],
		},
	},
];
