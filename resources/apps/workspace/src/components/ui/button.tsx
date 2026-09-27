import * as React from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
	'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:opacity-90',
				destructive:
					'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
				outline: 'border border-border bg-transparent text-foreground hover:bg-muted',
				secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
				ghost: 'hover:bg-muted',
				link: 'text-foreground underline-offset-4 hover:underline',
			},
			size: {
				default: 'px-3 py-1.5',
				sm: 'h-7 rounded-md px-2.5 text-xs',
				lg: 'h-9 rounded-md px-4 text-sm',
				icon: 'size-8',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, ...props }, ref) => {
		return (
			<button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
		);
	}
);
Button.displayName = 'Button';

export { Button, buttonVariants };
