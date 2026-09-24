const SCOPES: Readonly<Record<string, readonly string[]>> = {
	'gmailmcp.googleapis.com': ['gmail.readonly', 'gmail.compose'],
	'calendarmcp.googleapis.com': [
		'calendar.calendarlist.readonly',
		'calendar.events.freebusy',
		'calendar.events.readonly',
	],
	'drivemcp.googleapis.com': ['drive.readonly', 'drive.file'],
	'people.googleapis.com': ['directory.readonly', 'userinfo.profile', 'contacts.readonly'],
};

export function googleMcpScopes(value: string): string | undefined {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || url.port || url.pathname.replace(/\/$/, '') !== '/mcp/v1') {
			return undefined;
		}
		return SCOPES[url.hostname]
			?.map((scope) => `https://www.googleapis.com/auth/${scope}`)
			.join(' ');
	} catch {
		return undefined;
	}
}
