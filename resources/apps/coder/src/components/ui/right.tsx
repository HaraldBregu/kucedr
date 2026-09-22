import { PanelRightClose } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function RightSidebar({
	children,
	open,
	onOpenChange,
}: {
	children: ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [width, setWidth] = useState(384);
	const [resizing, setResizing] = useState(false);
	const panelStyle = { width: open ? width : 0 } as CSSProperties;

	return (
		<aside
			aria-label="Coder chat"
			aria-hidden={!open}
			className={cn(
				'relative flex min-h-0 shrink-0 flex-col overflow-hidden border-l bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear motion-reduce:transition-none',
				!open && 'border-l-0',
				resizing && 'transition-none'
			)}
			style={panelStyle}
		>
			<div
				role="separator"
				aria-label="Resize chat sidebar"
				aria-orientation="vertical"
				aria-valuemin={320}
				aria-valuemax={720}
				aria-valuenow={width}
				className="absolute inset-y-0 left-0 z-20 w-1 cursor-col-resize touch-none bg-transparent hover:bg-sidebar-ring/50"
				onPointerDown={(event) => {
					setResizing(true);
					event.currentTarget.setPointerCapture(event.pointerId);
				}}
				onPointerMove={(event) => {
					if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
					setWidth(Math.min(720, Math.max(320, window.innerWidth - event.clientX)));
				}}
				onPointerUp={(event) => {
					setResizing(false);
					event.currentTarget.releasePointerCapture(event.pointerId);
				}}
			/>
			<div className="flex h-12 shrink-0 items-center border-b border-sidebar-border px-3" style={{ width }}>
				<span className="text-xs font-medium">Chat</span>
				<Button
					variant="ghost"
					size="icon-sm"
					className="ml-auto"
					aria-label="Close chat sidebar"
					onClick={() => onOpenChange(false)}
				>
					<PanelRightClose />
				</Button>
			</div>
			<div className="flex min-h-0 flex-1 flex-col" style={{ width }}>
				{children}
			</div>
		</aside>
	);
}
