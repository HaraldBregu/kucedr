import { Code2 } from 'lucide-react';

interface CodeSidebarProps {
	readonly title: string;
}

export function CodeSidebar({ title }: CodeSidebarProps): React.JSX.Element {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
				<Code2 className="size-4 shrink-0" strokeWidth={1.8} />
				<h1 className="truncate text-sm font-medium">{title}</h1>
			</header>
		</div>
	);
}
