import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
			{...props}
		/>
	);
}
