import type { ReactElement } from 'react';
import gmail from '@resources/providers/google/images/gmail.svg';

export function GmailIcon({ className }: { readonly className?: string }): ReactElement {
	return <img src={gmail} alt="" aria-hidden="true" className={className} />;
}
