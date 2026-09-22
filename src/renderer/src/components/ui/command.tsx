'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot="command"
			className={cn(
				'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
				className
			)}
			{...props}
		/>
	);
}

function CommandDialog({
	className,
	overlayClassName,
	contentClassName,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Dialog>) {
	return (
		<CommandPrimitive.Dialog
			data-slot="command-dialog"
			overlayClassName={cn('fixed inset-0 z-50 bg-black/40 backdrop-blur-sm', overlayClassName)}
			contentClassName={cn(
				'fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/20 outline-none',
				contentClassName
			)}
			className={cn('flex h-full w-full flex-col overflow-hidden', className)}
			{...props}
		/>
	);
}

function CommandInput({
	className,
	style,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div
			data-slot="command-input-wrapper"
			className="flex h-11 items-center gap-2 border-b border-border/70 px-3"
		>
			<SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					'flex h-10 w-full rounded-md bg-transparent py-2 text-xs outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
					className
				)}
				style={{ ...style, outline: 'none' }}
				{...props}
			/>
		</div>
	);
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn(
				'no-scrollbar max-h-[min(60vh,420px)] overflow-y-auto overflow-x-hidden p-1.5',
				className
			)}
			{...props}
		/>
	);
}

function CommandEmpty({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className={cn('py-6 text-center text-xs text-muted-foreground', className)}
			{...props}
		/>
	);
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground',
				className
			)}
			{...props}
		/>
	);
}

function CommandSeparator({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			data-slot="command-separator"
			className={cn('-mx-1 my-1 h-px bg-border', className)}
			{...props}
		/>
	);
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			className={cn(
				'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
				className
			)}
			{...props}
		/>
	);
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
	return (
		<span
			data-slot="command-shortcut"
			className={cn('ml-auto text-xs text-muted-foreground', className)}
			{...props}
		/>
	);
}

export {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
};
