import type { ItemInstance } from '@headless-tree/core';
import type { WorkspaceTreeEntry } from '@kucedr/sdk';
import { FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react';

import { TreeItem, TreeItemLabel } from '@/components/ui/tree';

interface BreadcrumbTreeItemProps {
	entry: WorkspaceTreeEntry;
	item: ItemInstance<WorkspaceTreeEntry>;
	onFileSelect: (entry: WorkspaceTreeEntry) => void;
}

export function BreadcrumbTreeItem({ entry, item, onFileSelect }: BreadcrumbTreeItemProps) {
	const isDirectory = entry.type === 'directory';
	return (
		<TreeItem item={item} title={entry.path}>
			<TreeItemLabel onClick={() => !isDirectory && onFileSelect(entry)}>
				<span className="-order-1 flex min-w-0 flex-1 items-center gap-1.5">
					{isDirectory ? (
						item.isExpanded() ? (
							<FolderOpenIcon className="size-3.5 shrink-0 text-sidebar-muted" />
						) : (
							<FolderIcon className="size-3.5 shrink-0 text-sidebar-muted" />
						)
					) : (
						<FileIcon className="size-3.5 shrink-0 text-sidebar-muted" />
					)}
					<span className="truncate">{entry.name}</span>
				</span>
			</TreeItemLabel>
		</TreeItem>
	);
}
