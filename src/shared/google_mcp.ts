const SCOPES: Readonly<Record<string, readonly string[]>> = {
	'gmailmcp.googleapis.com': ['gmail.readonly', 'gmail.compose'],
	'calendarmcp.googleapis.com': [
		'calendar.calendarlist.readonly',
		'calendar.events.freebusy',
		'calendar.events.readonly',
	],
	'drivemcp.googleapis.com': ['drive.readonly', 'drive.file'],
	'docsmcp.googleapis.com': ['drive.readonly', 'drive.file', 'documents.readonly', 'documents'],
	'sheetsmcp.googleapis.com': [
		'drive.readonly',
		'drive.file',
		'spreadsheets.readonly',
		'spreadsheets',
	],
	'people.googleapis.com': ['directory.readonly', 'userinfo.profile', 'contacts.readonly'],
	'mapstools.googleapis.com': ['maps-platform.mapstools'],
};

export function googleMcpScopes(value: string): string | undefined {
	try {
		const url = new URL(value);
		const path = url.pathname.replace(/\/$/, '');
		if (
			url.protocol !== 'https:' ||
			url.port ||
			path !== (url.hostname === 'mapstools.googleapis.com' ? '/mcp' : '/mcp/v1')
		) {
			return undefined;
		}
		return SCOPES[url.hostname]
			?.map((scope) => `https://www.googleapis.com/auth/${scope}`)
			.join(' ');
	} catch {
		return undefined;
	}
}
