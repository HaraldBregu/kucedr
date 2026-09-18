import React, { memo, type ReactNode, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface NavigationBarContainerProps {
	readonly className?: string;
	readonly style?: React.CSSProperties;
	readonly onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
	readonly children: ReactNode;
}

export const NavigationBarContainer = memo(function AppNavigationBarContainer({
	className,
	style,
	onContextMenu,
	children,
}: NavigationBarContainerProps): ReactElement {
	return (
		<div
			data-slot="navigationbar"
			className={cn(
				'fixed inset-x-0 top-0 z-50 flex h-12 shrink-0 items-center border-b border-border bg-transparent select-none transition-[left] duration-200 ease-linear',
				className
			)}
			style={
				{
					WebkitAppRegion: 'drag',
					...style,
				} as React.CSSProperties
			}
			onContextMenu={onContextMenu}
		>
			{children}
		</div>
	);
});
