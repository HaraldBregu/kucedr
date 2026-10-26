const SERVICES: Record<string, { name: string }> = {
	gmail: { name: 'Gmail' },
	'gmail-smtp': { name: 'Gmail' },
	'google-calendar': { name: 'Google Calendar' },
	'google-drive': { name: 'Google Drive' },
	'google-contacts': { name: 'Google Contacts' },
};

export function googleService(toolPart: { type: string; serviceId?: string }) {
	const id = toolPart.serviceId ?? toolPart.type.split('__')[1];
	return id ? SERVICES[id.toLowerCase()] : undefined;
}
