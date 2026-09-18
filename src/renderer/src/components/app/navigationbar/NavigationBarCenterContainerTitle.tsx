import { memo, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface TitleBarCenterContainerTitleProps {
	readonly className?: string;
	readonly children: string;
}

export const TitleBarCenterContainerTitle = memo(function AppTitleBarCenterContainerTitle({
	className,
	children,
}: TitleBarCenterContainerTitleProps): ReactElement {
	return <span className={cn('text-sm font-normal tracking-wide', className)}>{children}</span>;
});
