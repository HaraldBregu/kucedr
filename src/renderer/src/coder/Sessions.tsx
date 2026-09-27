import { Plus } from 'lucide-react';
import { SPLIT_ITEM_ACTIVE_CLASS, SPLIT_ITEM_CLASS } from '@/components/app/base/page';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { Workspace } from './workspace';

export function Sessions({
	coding,
	onSelect,
}: {
	coding: Workspace;
	onSelect: (projectId: string, sessionId?: string, fresh?: boolean) => void;
}) {
	const project = coding.projects.find((item) => item.id === coding.projectId);
	const sessions = project ? (coding.sessionsByProject[project.id] ?? []) : [];

	return (
		<>
			<header className="shrink-0 border-b border-sidebar-border/50 p-2">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							type="button"
							className="px-2.5 text-sm"
							disabled={!project?.available || coding.busy || coding.loading}
							onClick={() => project && onSelect(project.id, undefined, true)}
						>
							<Plus className="size-4 shrink-0" />
							<span className="truncate">New session</span>
							<kbd className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground opacity-0 group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100">
								{navigator.platform.startsWith('Mac') ? '⌘ + N' : 'Ctrl + N'}
							</kbd>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</header>
			<section
				className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2 pt-3"
				aria-busy={coding.loading}
			>
				<div className="px-2 pb-2 text-xs font-medium text-sidebar-foreground/70">Sessions</div>
				{coding.loading && !coding.projects.length && (
					<p className="px-2 py-1 text-xs text-muted-foreground">Loading projects…</p>
				)}
				{!coding.loading && !project && (
					<p className="px-2 py-1 text-xs text-muted-foreground">
						Choose a workspace to see its sessions.
					</p>
				)}
				<nav aria-label="Sessions">
					<ul className="flex min-w-0 flex-col gap-1">
						{sessions.map((session) => {
							const active = session.id === coding.snapshot?.session.id;
							return (
								<li key={session.id} className="flex min-w-0 items-center">
									<button
										type="button"
										aria-current={active ? 'page' : undefined}
										title={session.title}
										disabled={coding.busy || !project?.available}
										className={cn(
											SPLIT_ITEM_CLASS,
											'min-w-0 flex-1 disabled:pointer-events-none disabled:opacity-50',
											active && SPLIT_ITEM_ACTIVE_CLASS
										)}
										onClick={() => project && onSelect(project.id, session.id)}
									>
										<span>{session.title || 'Untitled session'}</span>
									</button>
								</li>
							);
						})}
					</ul>
					{project && !sessions.length && (
						<p className="px-2 py-1 text-xs text-muted-foreground">
							{project.available ? 'No sessions yet.' : 'Folder unavailable.'}
						</p>
					)}
				</nav>
			</section>
		</>
	);
}
