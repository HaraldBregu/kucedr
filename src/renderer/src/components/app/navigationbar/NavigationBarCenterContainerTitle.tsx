import { memo, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface NavigationBarCenterContainerTitleProps {
	readonly className?: string;
	readonly children: string;
}

export const NavigationBarCenterContainerTitle = memo(function AppNavigationBarCenterContainerTitle({
	className,
	children,
}: NavigationBarCenterContainerTitleProps): ReactElement {
	return <span className={cn('text-sm font-normal tracking-wide', className)}>{children}</span>;
});
