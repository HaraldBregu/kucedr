import React, { memo, type ReactNode, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface TitleBarRightContainerProps {
	readonly className?: string;
	readonly children: ReactNode;
}

export const TitleBarRightContainer = memo(function AppTitleBarRightContainer({
	className,
	children,
}: TitleBarRightContainerProps): ReactElement {
	return (
		<div
			className={cn('flex items-center h-full z-10 gap-1', className)}
			style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
		>
			{children}
		</div>
	);
});
