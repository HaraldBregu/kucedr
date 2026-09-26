import { cn } from '@/lib/utils';

export function Resize({
	side,
	width,
	minWidth,
	maxWidth,
	label,
	className,
	onWidthChange,
}: {
	side: 'left' | 'right';
	width: number;
	minWidth: number;
	maxWidth: number;
	label: string;
	className: string;
	onWidthChange: (width: number) => void;
}) {
	const direction = side === 'right' ? 1 : -1;
	return (
		<button
			type="button"
			data-slot="coder-sidebar-resizer"
			role="separator"
			aria-label={label}
			aria-orientation="vertical"
			aria-valuemin={minWidth}
			aria-valuemax={maxWidth}
			aria-valuenow={width}
			tabIndex={0}
			title={label}
			className={cn(
				'absolute inset-y-0 z-20 hidden w-3 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 hover:after:bg-sidebar-border focus-visible:after:bg-ring',
				side === 'right' ? '-right-1.5' : '-left-1.5',
				className
			)}
			onKeyDown={(event) => {
				if (event.key === 'ArrowLeft') {
					event.preventDefault();
					onWidthChange(width - direction * 8);
				}
				if (event.key === 'ArrowRight') {
					event.preventDefault();
					onWidthChange(width + direction * 8);
				}
				if (event.key === 'Home') {
					event.preventDefault();
					onWidthChange(minWidth);
				}
				if (event.key === 'End') {
					event.preventDefault();
					onWidthChange(maxWidth);
				}
			}}
			onPointerDown={(event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				const startX = event.clientX;
				const startWidth = width;
				const previousCursor = document.body.style.cursor;
				const previousUserSelect = document.body.style.userSelect;
				document.body.style.cursor = 'col-resize';
				document.body.style.userSelect = 'none';

				const handlePointerMove = (moveEvent: PointerEvent): void => {
					onWidthChange(startWidth + direction * (moveEvent.clientX - startX));
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
	);
}
