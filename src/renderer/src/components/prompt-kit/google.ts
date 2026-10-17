import type { ElementType } from 'react';
import { CalendarIcon } from './calendar';
import { ContactsIcon } from './contacts';
import { DriveIcon } from './drive';
import { GmailIcon } from './gmail';

const SERVICES: Record<string, { name: string; icon: ElementType<{ className?: string }> }> = {
	gmail: { name: 'Gmail', icon: GmailIcon },
	'gmail-smtp': { name: 'Gmail', icon: GmailIcon },
	'google-calendar': { name: 'Google Calendar', icon: CalendarIcon },
	'google-drive': { name: 'Google Drive', icon: DriveIcon },
	'google-contacts': { name: 'Google Contacts', icon: ContactsIcon },
};

export function googleService(toolPart: { type: string; serviceId?: string }) {
	const id = toolPart.serviceId ?? toolPart.type.split('__')[1];
	return id ? SERVICES[id.toLowerCase()] : undefined;
}
