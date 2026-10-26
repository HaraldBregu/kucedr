import type { ReactElement } from 'react';
import calendar from '@/assets/google-calendar.svg';

export function CalendarIcon({ className }: { readonly className?: string }): ReactElement {
	return <img src={calendar} alt="" aria-hidden="true" className={className} />;
}
