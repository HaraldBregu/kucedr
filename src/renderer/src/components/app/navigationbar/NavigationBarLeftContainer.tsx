import React, { memo, type ReactNode, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface TitleBarLeftContainerProps {
	readonly isMac: boolean;
	readonly isFullScreen?: boolean;
	readonly className?: string;
	readonly children: ReactNode;
}

export const TitleBarLeftContainer = memo(function AppTitleBarLeftContainer({
	isMac,
	isFullScreen = false,
	className,
	children,
}: TitleBarLeftContainerProps): ReactElement {
	return (
		<div
			className={cn(
				'flex items-center h-full z-10 gap-1',
				isMac && (isFullScreen ? 'ml-2' : 'ml-20'),
				className
			)}
			style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
		>
			{children}
		</div>
	);
});
