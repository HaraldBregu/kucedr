import { createContext, useContext, useEffect, type ComponentProps, type ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { Button } from './button';

interface SidebarContextValue {
	open: boolean;
	toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
	open,
	onOpenChange,
	children,
	className,
	...props
}: ComponentProps<'div'> & {
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
			<div className={cn('flex h-full min-h-0 w-full', className)} {...props}>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}

export function Sidebar({ className, ...props }: ComponentProps<'aside'>) {
	const context = useContext(SidebarContext);
	if (!context) throw new Error('Sidebar must be rendered inside SidebarProvider.');

	return (
		<div
			className={cn(
				'relative h-full w-60 shrink-0 transition-[width] duration-200 ease-linear motion-reduce:transition-none',
				!context.open && 'w-0'
			)}
		>
			<aside
				id="demo-sidebar"
				data-state={context.open ? 'expanded' : 'collapsed'}
				className={cn(
					'absolute inset-y-0 left-0 flex w-60 flex-col overflow-hidden border-r border-border bg-card text-card-foreground transition-transform duration-200 ease-linear motion-reduce:transition-none',
					!context.open && '-translate-x-full',
					className
				)}
				{...props}
			/>
		</div>
	);
}

export function SidebarContent({ className, ...props }: ComponentProps<'div'>) {
	return <div className={cn('min-h-0 flex-1 overflow-y-auto', className)} {...props} />;
}

export function SidebarInset({ className, ...props }: ComponentProps<'section'>) {
	return <section className={cn('flex min-w-0 flex-1 flex-col', className)} {...props} />;
}

export function SidebarTrigger({ className, ...props }: ComponentProps<typeof Button>) {
	const context = useContext(SidebarContext);
	if (!context) throw new Error('SidebarTrigger must be rendered inside SidebarProvider.');

	return (
		<Button
			variant="ghost"
			size="icon"
			className={cn('shrink-0', className)}
			aria-controls="demo-sidebar"
			aria-expanded={context.open}
			aria-label={context.open ? 'Collapse sidebar' : 'Expand sidebar'}
			title={`${context.open ? 'Collapse' : 'Expand'} sidebar (⌘/Ctrl+B)`}
			onClick={context.toggle}
			{...props}
		>
			<span aria-hidden="true">☰</span>
		</Button>
	);
}
