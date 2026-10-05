import * as React from 'react';
import { cn } from '@/lib/utils';

export const TableHead = React.forwardRef<
	HTMLTableCellElement,
	React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
	<th
		ref={ref}
		className={cn(
			'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
			className
		)}
		{...props}
	/>
));
TableHead.displayName = 'TableHead';
