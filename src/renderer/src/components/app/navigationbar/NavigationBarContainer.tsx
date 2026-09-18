import React, { memo, type ReactNode, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface NavigationBarContainerProps {
	readonly className?: string;
	readonly onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
	readonly children: ReactNode;
}

export const NavigationBarContainer = memo(function AppNavigationBarContainer({
	className,
	onContextMenu,
	children,
}: NavigationBarContainerProps): ReactElement {
	return (
		<div
			data-slot="navigationbar"
			className={cn(
				'fixed inset-x-0 top-0 z-50 flex h-12 shrink-0 items-center border-b border-border bg-background select-none',
				className
			)}
			style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
			onContextMenu={onContextMenu}
		>
			{children}
		</div>
	);
});
