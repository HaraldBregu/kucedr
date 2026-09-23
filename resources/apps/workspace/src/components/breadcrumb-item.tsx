import { ChevronRight, File, Folder } from 'lucide-react';
import { useState } from 'react';
import type { WorkspaceTreeEntry } from '@kucedr/sdk';

import {
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';

interface WorkspaceBreadcrumbItemProps {
	entry: WorkspaceTreeEntry;
	onFileSelect: (entry: WorkspaceTreeEntry) => void;
}

export function WorkspaceBreadcrumbItem({ entry, onFileSelect }: WorkspaceBreadcrumbItemProps) {
	const [open, setOpen] = useState(false);
	if (entry.type === 'file') {
		return (
			<DropdownMenuItem onSelect={() => onFileSelect(entry)}>
				<File />
				<span className="truncate">{entry.name}</span>
			</DropdownMenuItem>
		);
	}
	return (
		<DropdownMenuSub open={open} onOpenChange={setOpen}>
			<DropdownMenuSubTrigger onClick={() => setOpen(true)}>
				<Folder />
				<span className="min-w-0 flex-1 truncate">{entry.name}</span>
				<ChevronRight className="ml-auto size-3" />
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="max-h-80 min-w-56 overflow-y-auto">
				{entry.children?.map((child) => (
					<WorkspaceBreadcrumbItem key={child.path} entry={child} onFileSelect={onFileSelect} />
				))}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
