import React from 'react';
import { Blocks } from 'lucide-react';
import type { App } from '@shared/installed_app_types';
import { cn } from '@/lib/utils';

export default function AppIcon({
	app,
	className,
}: {
	readonly app: App;
	readonly className: string;
}): React.JSX.Element {
	if (!app.imageUrl) {
		return (
			<div
				className={cn(
					'flex shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground',
					className
				)}
			>
				<Blocks className="size-1/2" aria-hidden="true" />
			</div>
		);
	}
	return <img src={app.imageUrl} alt="" className={cn('shrink-0 object-contain', className)} />;
}
