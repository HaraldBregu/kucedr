import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function ButtonGroup({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
	return <div data-slot="button-group" className={cn('inline-flex items-stretch', className)} {...props} />;
}
