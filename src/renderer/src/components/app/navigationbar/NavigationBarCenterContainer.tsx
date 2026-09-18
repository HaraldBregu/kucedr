import { memo, type ReactNode, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface NavigationBarCenterContainerProps {
	readonly className?: string;
	readonly style?: React.CSSProperties;
	readonly children: ReactNode;
}

export const NavigationBarCenterContainer = memo(function AppNavigationBarCenterContainer({
	className,
	style,
	children,
}: NavigationBarCenterContainerProps): ReactElement {
	return (
		<div
			className={cn(
				'absolute inset-0 flex items-center justify-center pointer-events-none bg-transparent',
				className
			)}
			style={style}
		>
			{children}
		</div>
	);
});
