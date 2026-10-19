import type { ReactElement } from 'react';
import contacts from '@resources/plugins/bootstrap-kucedr/providers/google/images/google-contact.svg';

export function ContactsIcon({ className }: { readonly className?: string }): ReactElement {
	return <img src={contacts} alt="" aria-hidden="true" className={className} />;
}
