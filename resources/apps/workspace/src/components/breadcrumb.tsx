import * as React from 'react';
import { hotkeysCoreFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { ChevronRight, Folder } from 'lucide-react';
import type { WorkspaceTreeEntry } from '@kucedr/sdk';

import { Button } from '@/components/ui/button';
import { BreadcrumbTreeItem } from '@/components/breadcrumb-tree-item';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tree } from '@/components/ui/tree';
import { findWorkspaceEntry } from '@/lib/find';

const breadcrumbRootId = '__breadcrumb_root__';

interface WorkspaceBreadcrumbProps {
	entries: WorkspaceTreeEntry[];
	onFileSelect: (entry: WorkspaceTreeEntry) => void;
	path: string;
}

function WorkspaceBreadcrumbTree({
	entries,
	onFileSelect,
}: Pick<WorkspaceBreadcrumbProps, 'entries' | 'onFileSelect'>) {
	const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
	const treeEntries = React.useMemo(() => {
		const result = new Map<string, WorkspaceTreeEntry>();
		const addEntries = (items: WorkspaceTreeEntry[]) => {
			for (const item of items) {
				result.set(item.path, item);
				if (item.children) addEntries(item.children);
			}
		};
		addEntries(entries);
		return result;
	}, [entries]);
	const expandedItems = React.useMemo(() => [...expanded], [expanded]);
	const setExpandedItems = React.useCallback((next: string[] | ((current: string[]) => string[])) => {
		setExpanded((current) => new Set(typeof next === 'function' ? next([...current]) : next));
	}, []);
	const tree = useTree<WorkspaceTreeEntry>({
		dataLoader: {
			getChildren: (itemId) =>
				itemId === breadcrumbRootId
					? entries.map((entry) => entry.path)
					: treeEntries.get(itemId)?.children?.map((entry) => entry.path) ?? [],
			getItem: (itemId) =>
				itemId === breadcrumbRootId
					? ({ name: 'Workspace', path: breadcrumbRootId, type: 'directory', children: entries } as WorkspaceTreeEntry)
					: treeEntries.get(itemId)!,
		},
		features: [syncDataLoaderFeature, hotkeysCoreFeature],
		getItemName: (item) => item.getItemData().name,
		indent: 14,
		isItemFolder: (item) => item.getItemData().type === 'directory',
		rootItemId: breadcrumbRootId,
		state: { expandedItems },
		setExpandedItems,
	});
	React.useEffect(() => {
		tree.rebuildTree();
	}, [entries, tree]);
	return (
		<Tree className="space-y-0.5 p-1" indent={14} tree={tree}>
			{tree.getItems().map((item) => (
				<BreadcrumbTreeItem
					key={item.getId()}
					entry={item.getItemData()}
					item={item}
					onFileSelect={onFileSelect}
				/>
			))}
		</Tree>
	);
}

export function WorkspaceBreadcrumb({
	entries,
	onFileSelect,
	path,
}: WorkspaceBreadcrumbProps) {
	const segments = path.split(/[\\/]/).filter(Boolean);
	const separator = path.includes('\\') ? '\\' : '/';
	const [treeOpen, setTreeOpen] = React.useState(false);
	const [segmentTreePath, setSegmentTreePath] = React.useState<string | null>(null);
	return (
		<nav aria-label="File path" className="flex min-w-0 flex-1 items-center overflow-hidden text-xs">
			<DropdownMenu open={treeOpen} onOpenChange={setTreeOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="mr-1 size-7 shrink-0"
						aria-label="Browse workspace root"
					>
						<Folder />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="max-h-80 min-w-64 overflow-y-auto p-0">
					<WorkspaceBreadcrumbTree
						entries={entries}
						onFileSelect={(entry) => {
							setTreeOpen(false);
							onFileSelect(entry);
						}}
					/>
				</DropdownMenuContent>
			</DropdownMenu>
			<ChevronRight aria-hidden="true" className="mx-0.5 size-3 shrink-0 text-muted-foreground" />
			{segments.map((segment, index) => {
				const segmentPath = segments.slice(0, index + 1).join(separator);
				const isFile = index === segments.length - 1;
				const items = findWorkspaceEntry(entries, segmentPath)?.children ?? [];
				return (
					<React.Fragment key={segmentPath}>
						{index > 0 ? <ChevronRight aria-hidden="true" className="mx-0.5 size-3 shrink-0 text-muted-foreground" /> : null}
						{isFile ? (
							<span className="min-w-0 truncate font-medium" title={path}>
								{segment}
							</span>
						) : (
							<DropdownMenu
								open={segmentTreePath === segmentPath}
								onOpenChange={(open) => setSegmentTreePath(open ? segmentPath : null)}
							>
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
								<DropdownMenuContent align="start" className="max-h-80 min-w-56 overflow-y-auto p-0">
									<WorkspaceBreadcrumbTree
										entries={items}
										onFileSelect={(entry) => {
											setSegmentTreePath(null);
											onFileSelect(entry);
										}}
									/>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</React.Fragment>
				);
			})}
		</nav>
	);
}
