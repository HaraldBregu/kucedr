import React, { memo, type ReactNode, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface NavigationBarRightContainerProps {
	readonly className?: string;
	readonly children: ReactNode;
}

export const NavigationBarRightContainer = memo(function AppNavigationBarRightContainer({
	className,
	children,
}: NavigationBarRightContainerProps): ReactElement {
	return (
		<div
			className={cn('flex items-center h-full z-10 gap-1', className)}
			style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
		>
			{children}
		</div>
	);
});
