import React, { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { usePageContext } from './hooks/use-page-context';
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from './context/state';

interface SplitProps extends Omit<React.ComponentProps<'div'>, 'children'> {
	readonly children: ReactNode;
	readonly sidebar: ReactNode;
	readonly sidebarLabel?: string;
}

export function Split({
	children,
	sidebar,
	sidebarLabel = 'Navigation',
	className,
	style,
	...props
}: SplitProps): React.JSX.Element {
	const { state, dispatch, isMobile, sidebarWidth, setSidebarWidth, toggleSidebar } =
		usePageContext();
	const sidebarOpen = isMobile ? state.sidebarOpenMobile : state.sidebarOpen;

	return (
		<div
			data-slot="split-pane"
			className={cn('flex h-full min-h-0 w-full overflow-hidden', className)}
			style={
				{
					...style,
					'--split-pane-sidebar-width': `${sidebarWidth}px`,
				} as React.CSSProperties
			}
			{...props}
		>
			{createPortal(
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					data-slot="split-pane-toggle"
					aria-label="Toggle Sidebar"
					aria-controls="split-pane-sidebar"
					aria-expanded={sidebarOpen}
					title="Toggle Sidebar"
					onClick={toggleSidebar}
					className="fixed left-20 top-2.5 z-50 size-7 text-muted-foreground"
					style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
				>
					<PanelLeft className="size-4" strokeWidth={1.5} />
				</Button>,
				document.body
			)}
			{isMobile ? (
				<Sheet
					open={state.sidebarOpenMobile}
					onOpenChange={(open) => dispatch({ type: 'SIDEBAR_OPEN_MOBILE_SET', open })}
				>
					<SheetContent
						side="left"
						className="bg-sidebar p-0 text-sidebar-foreground"
						style={{ width: 'min(18rem, calc(100vw - 3rem))', maxWidth: 'none' }}
					>
						<SheetHeader className="sr-only">
							<SheetTitle>{sidebarLabel}</SheetTitle>
							<SheetDescription>{sidebarLabel}</SheetDescription>
						</SheetHeader>
						<aside
							id="split-pane-sidebar"
							data-slot="split-pane-sidebar"
							aria-label={sidebarLabel}
							className="h-full"
						>
							{sidebar}
						</aside>
					</SheetContent>
				</Sheet>
			) : (
				<>
					<div
						data-slot="split-pane-gap"
						aria-hidden="true"
						className={cn(
							'shrink-0 transition-[width] duration-200 ease-linear motion-reduce:transition-none',
							state.sidebarOpen ? 'w-[var(--split-pane-sidebar-width)]' : 'w-0'
						)}
					/>
					<aside
						id="split-pane-sidebar"
						data-slot="split-pane-sidebar"
						data-state={state.sidebarOpen ? 'expanded' : 'collapsed'}
						aria-label={sidebarLabel}
						className={cn(
							'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-linear motion-reduce:transition-none',
							state.sidebarOpen ? 'translate-x-0' : '-translate-x-full'
						)}
						style={{ width: 'var(--split-pane-sidebar-width)' }}
					>
						{sidebar}
						<button
							type="button"
							data-slot="split-pane-resizer"
							role="separator"
							aria-label="Resize sidebar"
							aria-orientation="vertical"
							aria-valuemin={MIN_SIDEBAR_WIDTH}
							aria-valuemax={MAX_SIDEBAR_WIDTH}
							aria-valuenow={sidebarWidth}
							tabIndex={0}
							title="Resize sidebar"
							className="absolute inset-y-0 -right-1.5 z-20 w-3 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 hover:after:bg-sidebar-border focus-visible:after:bg-ring"
							onKeyDown={(event) => {
								if (event.key === 'ArrowLeft') {
									event.preventDefault();
									setSidebarWidth(sidebarWidth - 8);
								}
								if (event.key === 'ArrowRight') {
									event.preventDefault();
									setSidebarWidth(sidebarWidth + 8);
								}
								if (event.key === 'Home') {
									event.preventDefault();
									setSidebarWidth(MIN_SIDEBAR_WIDTH);
								}
								if (event.key === 'End') {
									event.preventDefault();
									setSidebarWidth(MAX_SIDEBAR_WIDTH);
								}
							}}
							onPointerDown={(event) => {
								if (event.button !== 0) return;
								event.preventDefault();
								const startX = event.clientX;
								const startWidth = sidebarWidth;
								const previousCursor = document.body.style.cursor;
								const previousUserSelect = document.body.style.userSelect;
								document.body.style.cursor = 'col-resize';
								document.body.style.userSelect = 'none';

								const handlePointerMove = (moveEvent: PointerEvent): void => {
									setSidebarWidth(startWidth + moveEvent.clientX - startX);
								};
								const stopResizing = (): void => {
									window.removeEventListener('pointermove', handlePointerMove);
									window.removeEventListener('pointerup', stopResizing);
									window.removeEventListener('pointercancel', stopResizing);
									document.body.style.cursor = previousCursor;
									document.body.style.userSelect = previousUserSelect;
								};

								window.addEventListener('pointermove', handlePointerMove);
								window.addEventListener('pointerup', stopResizing);
								window.addEventListener('pointercancel', stopResizing);
							}}
						/>
					</aside>
				</>
			)}
			<main
				data-slot="split-pane-content"
				className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-transparent"
			>
				{children}
			</main>
		</div>
	);
}
