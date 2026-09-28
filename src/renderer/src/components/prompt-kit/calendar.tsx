import type { ReactElement } from 'react';
import calendar from '@resources/providers/google/images/google-calendar.svg';

export function CalendarIcon({ className }: { readonly className?: string }): ReactElement {
	return <img src={calendar} alt="" aria-hidden="true" className={className} />;
}
