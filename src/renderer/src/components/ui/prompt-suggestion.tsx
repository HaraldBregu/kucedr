'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PromptSuggestionProps = {
	children: React.ReactNode;
	variant?: React.ComponentProps<typeof Button>['variant'];
	size?: React.ComponentProps<typeof Button>['size'];
	className?: string;
	highlight?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

function escapeRegExp(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string): React.ReactNode {
	if (!query) return text;
	const escaped = escapeRegExp(query);
	const re = new RegExp(`(${escaped})`, 'ig');
	const parts = text.split(re);
	return parts.map((part, i) =>
		re.test(part) ? (
			<span key={i} className="font-semibold text-foreground">
				{part}
			</span>
		) : (
			<span key={i} className="text-muted-foreground">
				{part}
			</span>
		)
	);
}

function PromptSuggestion({
	children,
	variant,
	size,
	className,
	highlight,
	...props
}: PromptSuggestionProps) {
	const isHighlightMode = typeof highlight === 'string';

	if (isHighlightMode && typeof children === 'string') {
		return (
			<Button
				variant={variant ?? 'ghost'}
				size={size ?? 'sm'}
				className={cn(
					'w-full justify-start rounded-md text-left text-sm font-normal',
					className
				)}
				{...props}
			>
				{highlightText(children, highlight ?? '')}
			</Button>
		);
	}

	return (
		<Button
			variant={variant ?? 'outline'}
			size={size ?? 'lg'}
			className={cn('rounded-full px-3 text-sm font-normal', className)}
			{...props}
		>
			{children}
		</Button>
	);
}

export { PromptSuggestion };
