import React, { type HTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItemProps extends HTMLAttributes<HTMLElement> {
	readonly children: ReactNode;
	readonly variant?: 'outline' | 'ghost';
	readonly size?: 'sm' | 'md';
	readonly as?: 'div' | 'button';
	readonly type?: 'button' | 'submit' | 'reset';
	readonly disabled?: boolean;
}

function Item({
	as = 'div',
	children,
	variant = 'outline',
	size = 'sm',
	className,
	...props
}: ItemProps): React.JSX.Element {
	const Component = as;

	return (
		<Component
			{...props}
			data-slot="item"
			data-variant={variant}
			data-size={size}
			className={cn(
				'group/item flex w-full flex-wrap items-center transition-colors duration-100 outline-none',
				'focus-visible:ring-[3px] focus-visible:ring-ring/50',
				size === 'sm' && 'gap-2 px-3 py-2',
				size === 'md' && 'gap-4 px-4 py-3',
				className
			)}
		>
			{children}
		</Component>
	);
}

interface ItemMediaProps {
	readonly children: ReactNode;
	readonly variant?: 'icon';
	readonly className?: string;
}

function ItemMedia({ children, variant = 'icon', className }: ItemMediaProps): React.JSX.Element {
	return (
		<div
			data-slot="item-media"
			data-variant={variant}
			className={cn(
				'flex shrink-0 items-center justify-center [&_svg]:pointer-events-none',
				variant === 'icon' && 'size-6 rounded-md bg-muted/60 text-muted-foreground',
				className
			)}
		>
			{children}
		</div>
	);
}

interface ItemContentProps {
	readonly children: ReactNode;
	readonly className?: string;
}

function ItemContent({ children, className }: ItemContentProps): React.JSX.Element {
	return (
		<div
			data-slot="item-content"
			className={cn('flex flex-1 flex-row items-center gap-4', className)}
		>
			{children}
		</div>
	);
}

interface ItemTitleProps {
	readonly children: ReactNode;
	readonly className?: string;
}

function ItemTitle({ children, className }: ItemTitleProps): React.JSX.Element {
	return (
		<div
			data-slot="item-title"
			className={cn('line-clamp-1 flex w-fit shrink-0 items-center text-[13px] font-medium text-foreground', className)}
		>
			{children}
		</div>
	);
}

interface ItemActionsProps {
	readonly children: ReactNode;
	readonly className?: string;
}

function ItemActions({ children, className }: ItemActionsProps): React.JSX.Element {
	return (
		<div
			data-slot="item-actions"
			className={cn('flex flex-1 items-center', className)}
		>
			{children}
		</div>
	);
}

interface ItemIconProps {
	readonly icon: LucideIcon;
	readonly className?: string;
}

function ItemIcon({ icon: Icon, className }: ItemIconProps): React.JSX.Element {
	return (
		<ItemMedia variant="icon" className={className}>
			<Icon className="size-3" strokeWidth={1.8} />
		</ItemMedia>
	);
}

export { Item, ItemMedia, ItemContent, ItemTitle, ItemActions, ItemIcon };
