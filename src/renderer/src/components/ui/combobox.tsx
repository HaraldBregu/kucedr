'use client';

import * as React from 'react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';

import { cn } from '@/lib/utils';

const Combobox = ComboboxPrimitive.Root;

function ComboboxInput({
	className,
	...props
}: React.ComponentProps<typeof ComboboxPrimitive.Input>): React.JSX.Element {
	return (
		<ComboboxPrimitive.Input
			data-slot="combobox-input"
			className={cn(
				'flex h-8 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

function ComboboxContent({
	className,
	...props
}: React.ComponentProps<typeof ComboboxPrimitive.Popup>): React.JSX.Element {
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner sideOffset={4} className="z-50">
				<ComboboxPrimitive.Popup
					data-slot="combobox-content"
					className={cn(
						'w-[var(--anchor-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
						className
					)}
					{...props}
				/>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
}

function ComboboxList({
	className,
	...props
}: React.ComponentProps<typeof ComboboxPrimitive.List>): React.JSX.Element {
	return (
		<ComboboxPrimitive.List
			data-slot="combobox-list"
			className={cn('max-h-72 overflow-y-auto p-1', className)}
			{...props}
		/>
	);
}

function ComboboxItem({
	className,
	...props
}: React.ComponentProps<typeof ComboboxPrimitive.Item>): React.JSX.Element {
	return (
		<ComboboxPrimitive.Item
			data-slot="combobox-item"
			className={cn(
				'flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

function ComboboxEmpty({
	className,
	...props
}: React.ComponentProps<typeof ComboboxPrimitive.Empty>): React.JSX.Element {
	return (
		<ComboboxPrimitive.Empty
			data-slot="combobox-empty"
			className={cn('px-2 py-3 text-center text-sm text-muted-foreground', className)}
			{...props}
		/>
	);
}

export { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList };
