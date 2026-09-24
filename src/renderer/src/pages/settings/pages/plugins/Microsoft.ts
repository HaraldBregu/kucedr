export const MICROSOFT_365_SERVICES = [
	{
		id: 'microsoft-mail',
		name: 'Outlook Mail',
		description: 'Read, send, and manage email.',
		serverId: 'mcp_MailTools',
	},
	{
		id: 'microsoft-calendar',
		name: 'Outlook Calendar',
		description: 'Manage events and availability.',
		serverId: 'mcp_CalendarTools',
	},
	{
		id: 'microsoft-teams',
		name: 'Microsoft Teams',
		description: 'Work with chats, channels, and messages.',
		serverId: 'mcp_TeamsServer',
	},
	{
		id: 'microsoft-onedrive',
		name: 'OneDrive',
		description: 'Find and manage personal files.',
		serverId: 'mcp_OneDriveRemoteServer',
	},
	{
		id: 'microsoft-sharepoint',
		name: 'SharePoint',
		description: 'Work with sites, lists, and files.',
		serverId: 'mcp_SharePointRemoteServer',
	},
	{
		id: 'microsoft-word',
		name: 'Microsoft Word',
		description: 'Create and read documents.',
		serverId: 'mcp_WordServer',
	},
	{
		id: 'microsoft-search',
		name: 'Microsoft 365 Search',
		description: 'Find content across Microsoft 365.',
		serverId: 'mcp_M365Copilot',
	},
] as const;
