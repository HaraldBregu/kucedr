import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PromptInputField({
	children,
	header,
	controls,
	expanded,
	className,
}: {
	readonly children: ReactNode;
	readonly header?: ReactNode;
	readonly controls?: ReactNode;
	readonly expanded: boolean;
	readonly className?: string;
}): React.JSX.Element {
	return (
		<div
			data-slot="prompt-input-field"
			className={cn(
				'flex min-h-[104px] flex-col rounded-[24px] border border-border/60 bg-card/95 px-2 pb-2 pt-3 shadow-sm shadow-foreground/5 focus-within:ring-1 focus-within:ring-ring/25 transition-[min-height,padding] duration-150 ease-out motion-reduce:transition-none',
				expanded && 'min-h-32',
				className
			)}
		>
			<div className="min-w-0 flex-1 px-2">
				{header ? <div className="mb-2">{header}</div> : null}
				{children}
			</div>
			{controls}
		</div>
	);
}
