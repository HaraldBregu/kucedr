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

const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentPropsWithoutRef<'ul'>>(
	({ className, ...props }, ref) => (
		<ul ref={ref} data-sidebar="menu" className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />
	)
);
SidebarMenu.displayName = 'SidebarMenu';

const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<'li'>>(
	({ className, ...props }, ref) => <li ref={ref} data-sidebar="menu-item" className={cn('group/menu-item relative', className)} {...props} />
);
SidebarMenuItem.displayName = 'SidebarMenuItem';

interface SidebarMenuButtonProps extends React.ComponentPropsWithoutRef<'button'> {
	readonly size?: 'default' | 'sm' | 'lg';
}

const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
	({ className, size = 'default', ...props }, ref) => (
		<button
			ref={ref}
			data-sidebar="menu-button"
			data-size={size}
			className={cn(
				'flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground',
				size === 'sm' && 'h-7 text-xs',
				size === 'default' && 'h-8',
				size === 'lg' && 'h-12',
				className
			)}
			{...props}
		/>
	)
);
SidebarMenuButton.displayName = 'SidebarMenuButton';

export { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem };
