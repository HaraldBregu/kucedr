import { PanelRightClose } from 'lucide-react';
import type { ReactNode } from 'react';

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
	return (
		<aside
			aria-label="Coder chat"
			aria-hidden={!open}
			className={cn(
				'flex min-h-0 shrink-0 flex-col overflow-hidden border-l bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear motion-reduce:transition-none',
				open ? 'w-96' : 'w-0 border-l-0'
			)}
		>
			<div className="flex h-12 w-96 shrink-0 items-center border-b border-sidebar-border px-3">
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
			<div className="flex min-h-0 w-96 flex-1 flex-col">{children}</div>
		</aside>
	);
}
