import * as React from 'react';
import { ChevronRight, File, Folder } from 'lucide-react';
import type { WorkspaceTreeEntry } from '@kucedr/sdk';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { findWorkspaceEntry } from '@/lib/find';

interface WorkspaceBreadcrumbProps {
	entries: WorkspaceTreeEntry[];
	onDirectorySelect: (entry: WorkspaceTreeEntry) => void;
	onFileSelect: (entry: WorkspaceTreeEntry) => void;
	path: string;
}

export function WorkspaceBreadcrumb({
	entries,
	onDirectorySelect,
	onFileSelect,
	path,
}: WorkspaceBreadcrumbProps) {
	const segments = path.split(/[\\/]/).filter(Boolean);
	const separator = path.includes('\\') ? '\\' : '/';
	return (
		<nav aria-label="File path" className="flex min-w-0 flex-1 items-center overflow-hidden text-xs">
			{segments.map((segment, index) => {
				const segmentPath = segments.slice(0, index + 1).join(separator);
				const isFile = index === segments.length - 1;
				const items = findWorkspaceEntry(entries, segmentPath)?.children ?? [];
				return (
					<React.Fragment key={segmentPath}>
						{index > 0 ? <ChevronRight className="mx-0.5 size-3 shrink-0 text-muted-foreground" /> : null}
						{isFile ? (
							<span className="min-w-0 truncate font-medium" title={path}>
								{segment}
							</span>
						) : (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-6 max-w-32 shrink truncate px-1.5 text-xs font-medium"
										aria-label={`Browse ${segment}`}
									>
										{segment}
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="max-h-80 min-w-56 overflow-y-auto">
									{items.map((item) => (
										<DropdownMenuItem
											key={item.path}
											onSelect={() => {
												if (item.type === 'file') onFileSelect(item);
												else onDirectorySelect(item);
											}}
										>
											{item.type === 'directory' ? <Folder /> : <File />}
											<span className="truncate">{item.name}</span>
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</React.Fragment>
				);
			})}
		</nav>
	);
}
