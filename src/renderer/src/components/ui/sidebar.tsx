import * as React from 'react';
import { cn } from '@/lib/utils';

const SidebarFooter = React.forwardRef<
	HTMLDivElement,
	React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		data-slot="sidebar-footer"
		className={cn('flex flex-col gap-2 p-2', className)}
		{...props}
	/>
));
SidebarFooter.displayName = 'SidebarFooter';

export { SidebarFooter };
