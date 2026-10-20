import React from 'react';
import { Plug } from 'lucide-react';
import type { PluginInfo } from '@shared/plugin_types';
import { cn } from '@/lib/utils';

export default function PluginIcon({
	plugin,
	className,
}: {
	readonly plugin: PluginInfo;
	readonly className: string;
}): React.JSX.Element {
	if (!plugin.icon) {
		return (
			<div
				className={cn(
					'flex shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground',
					className
				)}
			>
				<Plug className="size-1/2" aria-hidden="true" />
			</div>
		);
	}
	return (
		<>
			<img
				src={plugin.icon}
				alt=""
				className={cn('shrink-0 object-contain', plugin.iconDark && 'dark:hidden', className)}
			/>
			{plugin.iconDark && (
				<img
					src={plugin.iconDark}
					alt=""
					className={cn('hidden shrink-0 object-contain dark:block', className)}
				/>
			)}
		</>
	);
}
