import React from 'react';
import { cn } from '@/lib/utils';

function getProviderInitial(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const initials = words
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? '')
		.join('');

	return initials || name.slice(0, 1).toUpperCase();
}

export function ProviderAvatar({
	providerId,
	name,
	iconDarkUrl,
	iconLightUrl,
	className,
}: {
	readonly providerId: string;
	readonly name: string;
	readonly iconDarkUrl?: string;
	readonly iconLightUrl?: string;
	readonly className?: string;
}): React.JSX.Element {
	if (iconDarkUrl && iconLightUrl) {
		return (
			<div
				className={cn(
					'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background p-1',
					(providerId === 'brave' ||
						providerId === 'reka' ||
						providerId === 'tavily') &&
						'p-0',
					className
				)}
			>
				<img
					src={iconLightUrl}
					alt=""
					aria-hidden="true"
					draggable={false}
					className="size-full object-contain dark:hidden"
				/>
				<img
					src={iconDarkUrl}
					alt=""
					aria-hidden="true"
					draggable={false}
					className="hidden size-full object-contain dark:block"
				/>
			</div>
		);
	}

	return (
		<div
			className={cn(
				'flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground',
				className
			)}
		>
			{getProviderInitial(name || providerId)}
		</div>
	);
}
