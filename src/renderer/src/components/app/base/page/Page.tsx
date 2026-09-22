import React, { memo, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Provider } from './Provider';
import { PageContext } from './context/context';
import { usePageContext } from './hooks/use-page-context';
import type { PageState } from './context/state';

interface PageContainerProps {
	readonly children: ReactNode;
	readonly className?: string;
	readonly initialState?: Partial<PageState>;
}

export const PageContainer = memo(function PageContainer({
	children,
	className,
	initialState,
}: PageContainerProps): React.ReactElement {
	const pageContext = useContext(PageContext);
	const content = (
		<div
			className={cn('flex h-full flex-col bg-transparent', className)}
			style={
				{
					backgroundColor: 'var(--page-background)',
				} as React.CSSProperties
			}
		>
			{children}
		</div>
	);

	return pageContext ? content : <Provider initialState={initialState}>{content}</Provider>;
});

interface PageHeaderProps {
	readonly children: ReactNode;
	readonly className?: string;
}

export const PageHeader = memo(function PageHeader({
	children,
	className,
}: PageHeaderProps): React.ReactElement | null {
	const { state } = usePageContext();
	if (!state.isHeaderVisible) return null;
	return (
		<div
			className={cn(
				'app-translucent-surface flex shrink-0 flex-col border-b px-6 py-2 gap-1',
				className
			)}
			style={
				{
					backgroundColor: 'var(--page-header-background, var(--app-surface-background))',
				} as React.CSSProperties
			}
		>
			{children}
		</div>
	);
});

interface PageHeaderTitleProps {
	readonly children: ReactNode;
	readonly className?: string;
}

export const PageHeaderTitle = memo(function PageHeaderTitle({
	children,
	className,
}: PageHeaderTitleProps): React.ReactElement {
	return (
		<h1 className={cn('text-md font-medium flex items-center gap-2 flex-1 min-w-0', className)}>
			{children}
		</h1>
	);
});

interface PageHeaderDescriptionProps {
	readonly children: ReactNode;
	readonly className?: string;
}

export const PageHeaderDescription = memo(function PageHeaderDescription({
	children,
	className,
}: PageHeaderDescriptionProps): React.ReactElement {
	return (
		<p className={cn('text-sm text-muted-foreground flex items-center gap-3 flex-1 min-w-0', className)}>{children}</p>
	);
});

interface PageBodyProps {
	readonly children: ReactNode;
	readonly className?: string;
}

export const PageBody = memo(function PageBody({
	children,
	className,
}: PageBodyProps): React.ReactElement {
	return (
		<div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-4 pt-16', className)}>{children}</div>
	);
});

interface PageSidebarProps {
	readonly children: ReactNode;
	readonly className?: string;
}

export const PageSidebar = memo(function PageSidebar({
	children,
	className,
}: PageSidebarProps): React.ReactElement | null {
	const { state } = usePageContext();
	if (!state.isSidebarVisible) return null;
	return (
		<aside
			className={cn(
				'flex shrink-0 flex-col overflow-y-auto py-2',
				state.sidebarSide === 'left' ? 'order-first border-r' : 'order-last border-l',
				className
			)}
		>
			{children}
		</aside>
	);
});

interface PageSidebarInsetProps {
	readonly children: ReactNode;
	readonly className?: string;
}

export const PageSidebarInset = memo(function PageSidebarInset({
	children,
	className,
}: PageSidebarInsetProps): React.ReactElement {
	return (
		<div className={cn('flex min-w-0 flex-1 flex-col overflow-y-auto px-4 py-2', className)}>{children}</div>
	);
});
