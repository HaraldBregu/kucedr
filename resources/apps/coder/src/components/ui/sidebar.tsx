import { createContext, useContext, useEffect, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarContextValue {
	open: boolean;
	toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
	open,
	onOpenChange,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
}) {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
				event.preventDefault();
				onOpenChange(!open);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onOpenChange, open]);

	return (
		<SidebarContext.Provider value={{ open, toggle: () => onOpenChange(!open) }}>
			<div
				className="group/sidebar flex h-full min-h-0 w-full"
				data-state={open ? 'expanded' : 'collapsed'}
			>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}

export function Sidebar({ className, ...props }: ComponentProps<'aside'>) {
	const context = useContext(SidebarContext);
	if (!context) throw new Error('Sidebar must be rendered inside SidebarProvider.');
	return (
		<>
			<div
				aria-hidden="true"
				className={cn(
					'shrink-0 transition-[width] duration-200 ease-linear motion-reduce:transition-none',
					context.open ? 'w-64' : 'w-0'
				)}
			/>
			<aside
				id="coding-sidebar"
				data-state={context.open ? 'expanded' : 'collapsed'}
				className={cn(
					'fixed inset-y-0 left-0 z-30 flex w-64 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-linear motion-reduce:transition-none',
					!context.open && '-translate-x-full',
					className
				)}
				{...props}
			/>
		</>
	);
}

export function SidebarHeader({ className, ...props }: ComponentProps<'div'>) {
	return <div className={cn('shrink-0', className)} {...props} />;
}

export function SidebarContent({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div className={cn('min-h-0 flex-1 overflow-y-auto overflow-x-hidden', className)} {...props} />
	);
}

export function SidebarFooter({ className, ...props }: ComponentProps<'div'>) {
	return <div className={cn('shrink-0', className)} {...props} />;
}

export function SidebarInset({ className, ...props }: ComponentProps<'section'>) {
	return <section className={cn('flex min-w-0 flex-1 flex-col', className)} {...props} />;
}

export function SidebarTrigger({ className, ...props }: ComponentProps<typeof Button>) {
	const context = useContext(SidebarContext);
	if (!context) throw new Error('SidebarTrigger must be rendered inside SidebarProvider.');
	return createPortal(
		<Button
			variant="ghost"
			size="icon"
			className={cn(
				'fixed left-20 top-2.5 z-50 size-7 text-foreground hover:text-foreground',
				className
			)}
			aria-controls="coding-sidebar"
			aria-expanded={context.open}
			aria-label={context.open ? 'Collapse sidebar' : 'Expand sidebar'}
			title="Toggle Sidebar"
			onClick={context.toggle}
			{...props}
		>
			{context.open ? (
				<PanelLeftClose className="size-4" strokeWidth={1.5} />
			) : (
				<PanelLeftOpen className="size-4" strokeWidth={1.5} />
			)}
		</Button>,
		document.body
	);
}
