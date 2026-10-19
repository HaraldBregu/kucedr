import type { ReactElement } from 'react';
import calendar from '@resources/plugins/google/assets/google-calendar.svg';

export function CalendarIcon({ className }: { readonly className?: string }): ReactElement {
	return <img src={calendar} alt="" aria-hidden="true" className={className} />;
}
