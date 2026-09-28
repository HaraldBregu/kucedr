import { useState } from 'react';
import { ChevronRight, Folder } from 'lucide-react';
import type { WorkspaceTreeEntry } from '@shared/agent_types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { WorkspaceBreadcrumbTree } from './BreadcrumbTree';

interface WorkspaceBreadcrumbProps {
	readonly entries: WorkspaceTreeEntry[];
	readonly onFileSelect: (file: WorkspaceTreeEntry) => void;
	readonly path: string;
}

export function WorkspaceBreadcrumb({ entries, onFileSelect, path }: WorkspaceBreadcrumbProps): React.JSX.Element {
	const [openPath, setOpenPath] = useState<string | null>(null);
	const segments = path.split(/[\\/]/).filter(Boolean);
	const crumbs: { key: string; label: string; entries: WorkspaceTreeEntry[] }[] = [];
	let siblings = entries;
	for (const [index, label] of segments.entries()) {
		const current = siblings.find((entry) => entry.name === label);
		const file = index === segments.length - 1;
		crumbs.push({ key: segments.slice(0, index + 1).join('/'), label, entries: file ? siblings.filter((entry) => entry.type === 'file') : current?.children ?? [] });
		siblings = current?.children ?? [];
	}
	return (
		<nav aria-label="File path" className="flex min-w-0 flex-1 items-center overflow-hidden text-xs" title={path}>
			<DropdownMenu open={openPath === ''} onOpenChange={(open) => setOpenPath(open ? '' : null)}>
				<DropdownMenuTrigger asChild>
					<Button type="button" variant="ghost" size="icon-sm" className="mr-1 size-7 shrink-0" aria-label="Browse workspace root">
						<Folder aria-hidden="true" className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="max-h-80 min-w-64 overflow-y-auto p-0">
					<WorkspaceBreadcrumbTree entries={entries} selectedPath={path} onFileSelect={(entry) => { setOpenPath(null); onFileSelect(entry); }} />
				</DropdownMenuContent>
			</DropdownMenu>
			{crumbs.map((crumb) => (
				<span key={crumb.key} className="flex min-w-0 items-center">
					<ChevronRight aria-hidden="true" className="mx-0.5 size-3 shrink-0 text-muted-foreground" />
					<DropdownMenu open={openPath === crumb.key} onOpenChange={(open) => setOpenPath(open ? crumb.key : null)}>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="ghost" size="sm" className="h-6 max-w-32 min-w-0 shrink truncate px-1.5 text-xs font-medium" aria-label={`Browse ${crumb.label}`}>
								<span className="truncate">{crumb.label}</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="max-h-80 min-w-56 overflow-y-auto p-0">
							<WorkspaceBreadcrumbTree entries={crumb.entries} selectedPath={path} onFileSelect={(entry) => { setOpenPath(null); onFileSelect(entry); }} />
						</DropdownMenuContent>
					</DropdownMenu>
				</span>
			))}
		</nav>
	);
}
