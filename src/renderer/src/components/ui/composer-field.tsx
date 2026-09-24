import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PromptInputField({
	children,
	header,
	trailingAction,
	expanded,
	className,
}: {
	readonly children: ReactNode;
	readonly header?: ReactNode;
	readonly trailingAction?: ReactNode;
	readonly expanded: boolean;
	readonly className?: string;
}): React.JSX.Element {
	return (
		<div
			data-slot="prompt-input-field"
			className={cn(
				'grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-[16px] border border-border/60 bg-card/95 px-4 shadow-sm shadow-foreground/5 focus-within:ring-1 focus-within:ring-ring/25',
				expanded ? 'min-h-24 items-start py-4 pr-4' : 'min-h-14 items-center py-2 pr-2',
				className
			)}
		>
			<div className="min-w-0">
				{header ? <div className="mb-2">{header}</div> : null}
				{children}
			</div>
			<div className={expanded ? 'self-end' : 'self-center'}>{trailingAction}</div>
		</div>
	);
}
