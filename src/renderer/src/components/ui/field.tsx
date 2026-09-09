import React, { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

interface FieldProps {
	readonly children: ReactNode;
	readonly orientation?: 'horizontal' | 'vertical';
	readonly className?: string;
}

function Field({ children, orientation = 'vertical', className }: FieldProps): React.JSX.Element {
	return (
		<div
			data-slot="field"
			data-orientation={orientation}
			className={cn(
				orientation === 'horizontal' ? 'flex flex-row items-center gap-2' : 'flex flex-col gap-1.5',
				className
			)}
		>
			{children}
		</div>
	);
}

function FieldGroup({ children, className }: FieldProps): React.JSX.Element {
	return (
		<div data-slot="field-group" className={cn('flex w-full flex-col gap-4', className)}>
			{children}
		</div>
	);
}

function FieldLabel({
	className,
	...props
}: React.ComponentProps<typeof Label>): React.JSX.Element {
	return <Label className={className} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>): React.JSX.Element {
	return (
		<p
			data-slot="field-description"
			className={cn('text-muted-foreground text-sm leading-normal', className)}
			{...props}
		/>
	);
}

function FieldSeparator({
	children,
	className,
	...props
}: React.ComponentProps<'div'>): React.JSX.Element {
	return (
		<div
			data-slot="field-separator"
			className={cn('relative -my-1 h-5 text-center text-xs', className)}
			{...props}
		>
			<span className="relative z-10 bg-card px-2 text-muted-foreground">{children}</span>
			<span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
		</div>
	);
}

export { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator };
