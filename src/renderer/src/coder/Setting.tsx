import type { ReactNode } from 'react';

export function Setting({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
			<div className="min-w-0">
				<p className="text-xs font-medium">{title}</p>
				{description ? (
					<p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
				) : null}
			</div>
			<div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>
		</div>
	);
}
