import type { ItemInstance, TreeInstance } from '@headless-tree/core';
import { ChevronRight } from 'lucide-react';
import { createContext, useContext, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const TreeContext = createContext<{ indent: number } | null>(null);
const TreeItemContext = createContext<ItemInstance<unknown> | null>(null);

export function Tree({
	children,
	className,
	indent = 20,
	tree,
	...props
}: HTMLAttributes<HTMLDivElement> & { indent?: number; tree: TreeInstance<any> }) {
	return (
		<TreeContext.Provider value={{ indent }}>
			<div
				{...tree.getContainerProps('Workspace files')}
				{...props}
				className={cn('flex flex-col', className)}
				style={{ '--tree-indent': `${indent}px`, ...props.style } as React.CSSProperties}
			>
				{children}
			</div>
		</TreeContext.Provider>
	);
}

export function TreeItem({
	children,
	className,
	item,
	...props
}: HTMLAttributes<HTMLDivElement> & { item: ItemInstance<any> }) {
	const tree = useContext(TreeContext);
	const itemProps = item.getProps();
	return (
		<TreeItemContext.Provider value={item}>
			<div
				{...itemProps}
				{...props}
				aria-expanded={item.isFolder() ? item.isExpanded() : undefined}
				className={cn('group relative select-none outline-none', className)}
				data-folder={item.isFolder() || undefined}
				style={{ paddingInlineStart: item.getItemMeta().level * (tree?.indent ?? 20), ...props.style }}
			>
				{children}
			</div>
		</TreeItemContext.Provider>
	);
}

export function TreeItemLabel({
	children,
	className,
	...props
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
	const item = useContext(TreeItemContext);
	if (!item) return null;
	return (
		<div
			{...props}
			className={cn(
				'flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12px] font-medium text-sidebar-muted outline-none',
				'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-1 focus-visible:ring-sidebar-ring',
				'group-data-[selected=true]:bg-sidebar-accent group-data-[selected=true]:text-sidebar-foreground',
				className
			)}
		>
			{item.isFolder() ? (
				<ChevronRight
					className={cn('size-3 shrink-0 text-sidebar-muted transition-transform', item.isExpanded() && 'rotate-90')}
				/>
			) : (
				<span className="size-3 shrink-0" />
			)}
			{children ?? item.getItemName()}
		</div>
	);
}
