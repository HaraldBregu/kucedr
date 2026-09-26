import { useState } from 'react';
import {
	Check,
	ChevronsUpDown,
	Code2,
	FileText,
	Folder,
	FolderOpen,
	FolderPlus,
	MessageSquare,
	Plus,
	Search,
	Settings,
	Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Workspace } from './workspace';

export function Sidebar({
	coding,
	onSelect,
	onInstructions,
	onBeforeChange,
	onConfiguration,
}: {
	coding: Workspace;
	onBeforeChange: () => boolean;
	onSelect: (projectId: string, sessionId?: string, fresh?: boolean) => void;
	onInstructions: (projectId: string) => void;
	onConfiguration: () => void;
}) {
	const [query, setQuery] = useState('');
	const [searchOpen, setSearchOpen] = useState(false);
	const filter = query.trim().toLowerCase();
	const project = coding.projects.find((item) => item.id === coding.projectId);
	const projects = filter
		? coding.projects.filter(
				(item) =>
					`${item.name} ${item.directory}`.toLowerCase().includes(filter) ||
					coding.sessionsByProject[item.id]?.some((session) =>
						session.title.toLowerCase().includes(filter)
					)
			)
		: project
			? [project]
			: [];

	return (
		<aside
			aria-label="Sessions"
			className="absolute inset-y-0 left-0 z-20 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:static"
		>
			<div className="shrink-0 px-3 pb-3 pt-3">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label="Choose project"
							className="flex h-12 w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-2.5 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
						>
							<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-foreground">
								<Code2 className="size-4" />
							</span>
							<span className="min-w-0 flex-1 truncate font-medium">{project?.name ?? 'Choose project'}</span>
							<ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-60">
						<DropdownMenuLabel>Projects</DropdownMenuLabel>
						{coding.projects.map((item) => (
							<DropdownMenuItem
								key={item.id}
								disabled={coding.busy || !item.available}
								title={item.directory}
								onSelect={() => onSelect(item.id)}
							>
								<Folder />
								<span className="min-w-0 flex-1 truncate">{item.name}</span>
								{item.id === coding.projectId && <Check className="ml-auto" />}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							disabled={coding.busy || coding.loading}
							onSelect={() => {
								if (onBeforeChange()) void coding.addProject();
							}}
						>
							<FolderPlus />
							Open project folder
						</DropdownMenuItem>
						{project && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									disabled={!project.available}
									onSelect={() => onInstructions(project.id)}
								>
									<FileText />
									Agent instructions
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled={!project.available}
									onSelect={() => void coding.openProject(project.id)}
								>
									<FolderOpen />
									Open folder
								</DropdownMenuItem>
								<DropdownMenuItem
									className="text-destructive"
									disabled={coding.busy || coding.loading}
									onSelect={() => {
										if (onBeforeChange()) void coding.removeProject(project.id);
									}}
								>
									<Trash2 />
									Remove workspace
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="shrink-0 px-3 pb-3">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							type="button"
							aria-label="Search projects and sessions"
							aria-expanded={searchOpen}
							onClick={() => {
								setSearchOpen((open) => !open);
								setQuery('');
							}}
						>
							<Search className="size-4 shrink-0" />
							<span className="flex-1">Search</span>
							<kbd className="rounded-md border border-sidebar-border px-1.5 text-xs text-muted-foreground">/</kbd>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							type="button"
							disabled={!project?.available || coding.busy || coding.loading}
							onClick={() => project && onSelect(project.id, undefined, true)}
						>
							<Plus className="size-4 shrink-0" />
							<span>New session</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				{searchOpen && (
					<Input
						autoFocus
						aria-label="Search projects and sessions"
						placeholder="Search sessions…"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						className="mt-2 h-8 text-xs"
					/>
				)}
			</div>
			<nav
				className="min-h-0 flex-1 overflow-auto border-t border-sidebar-border px-3 pb-3 pt-3"
				aria-label="Projects and sessions"
				aria-busy={coding.loading}
			>
				<div className="px-2 pb-2 text-xs font-medium text-sidebar-foreground/70">Sessions</div>
				{coding.loading && !coding.projects.length && (
					<p className="px-2 py-1 text-xs text-muted-foreground">Loading projects…</p>
				)}
				{!coding.loading && !projects.length && (
					<p className="px-2 py-1 text-xs text-muted-foreground">
						{filter ? 'No matching sessions.' : 'Choose a project to see its sessions.'}
					</p>
				)}
				{projects.map((item) => {
					const projectMatches = `${item.name} ${item.directory}`.toLowerCase().includes(filter);
					const sessions = (coding.sessionsByProject[item.id] ?? []).filter(
						(session) => !filter || projectMatches || session.title.toLowerCase().includes(filter)
					);
					return (
						<div key={item.id}>
							{filter && <div className="px-2 py-1 text-xs text-muted-foreground">{item.name}</div>}
							<SidebarMenu>
								{sessions.map((session) => (
									<SidebarMenuItem key={session.id}>
										<SidebarMenuButton
											type="button"
											data-active={session.id === coding.snapshot?.session.id}
											aria-current={
												session.id === coding.snapshot?.session.id ? 'page' : undefined
											}
											title={session.title}
											disabled={coding.busy || !item.available}
											onClick={() => onSelect(item.id, session.id)}
										>
											<MessageSquare className="size-4 shrink-0" />
											<span className="truncate">{session.title || 'Untitled session'}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
							{!sessions.length && !filter && (
								<p className="px-2 py-1 text-xs text-muted-foreground">
									{item.available ? 'No sessions yet.' : 'Folder unavailable.'}
								</p>
							)}
						</div>
					);
				})}
			</nav>
			<SidebarFooter className="shrink-0 border-t border-sidebar-border">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton type="button" disabled={coding.busy} onClick={onConfiguration}>
							<Settings className="size-4 shrink-0" />
							<span>Settings</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</aside>
	);
}
