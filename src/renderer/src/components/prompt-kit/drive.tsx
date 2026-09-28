import type { ReactElement } from 'react';
import drive from '@resources/providers/google/images/google-drive.svg';

export function DriveIcon({ className }: { readonly className?: string }): ReactElement {
	return <img src={drive} alt="" aria-hidden="true" className={className} />;
}
