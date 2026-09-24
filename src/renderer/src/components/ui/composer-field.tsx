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
				'grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-2xl border border-border/60 bg-card/95 px-4 py-2 shadow-sm shadow-foreground/5 focus-within:ring-1 focus-within:ring-ring/25 transition-[min-height] duration-300 ease-out motion-reduce:transition-none',
				expanded ? 'min-h-24 items-start' : 'min-h-14 items-center',
				className
			)}
		>
			<div className="min-w-0">
				{header ? <div className="mb-2">{header}</div> : null}
				{children}
			</div>
			<div className="self-end">{trailingAction}</div>
		</div>
	);
}
