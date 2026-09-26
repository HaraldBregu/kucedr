import { useState } from 'react';
import {
	ChevronRight,
	FileText,
	Folder,
	FolderOpen,
	FolderPlus,
	MoreHorizontal,
	Plus,
	Search,
	Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Workspace } from './workspace';

export function Sidebar({
	coding,
	onSelect,
	onInstructions,
	onBeforeChange,
}: {
	coding: Workspace;
	onBeforeChange: () => boolean;
	onSelect: (projectId: string, sessionId?: string, fresh?: boolean) => void;
	onInstructions: (projectId: string) => void;
}) {
	const [query, setQuery] = useState('');
	const [collapsed, setCollapsed] = useState<string[]>([]);
	const filter = query.trim().toLowerCase();
	return (
		<aside
			aria-label="Sessions"
			className="absolute inset-y-0 left-0 z-20 flex w-60 shrink-0 flex-col border-r bg-sidebar md:static"
		>
			<div className="flex h-12 shrink-0 items-center justify-between px-3">
				<h2 className="text-xs font-medium">Projects</h2>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Open project folder"
					title="Open project folder"
					disabled={coding.busy || coding.loading}
					onClick={() => {
						if (onBeforeChange()) void coding.addProject();
					}}
				>
					<FolderPlus className="size-4" />
				</Button>
			</div>
			<div className="relative mx-2 mb-3">
				<Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
				<Input
					aria-label="Search projects and sessions"
					placeholder="Search sessions…"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					className="h-8 pl-8 text-xs"
				/>
			</div>
			<nav
				className="min-h-0 flex-1 overflow-auto px-2 pb-2"
				aria-label="Projects and sessions"
				aria-busy={coding.loading}
			>
				{coding.loading && !coding.projects.length && (
					<p className="p-2 text-xs text-muted-foreground">Loading projects…</p>
				)}
				{coding.projects
					.filter(
						(project) =>
							!filter ||
							`${project.name} ${project.directory}`.toLowerCase().includes(filter) ||
							coding.sessionsByProject[project.id]?.some((session) =>
								session.title.toLowerCase().includes(filter)
							)
					)
					.map((project) => {
						const expanded = Boolean(filter) || !collapsed.includes(project.id);
						const projectMatches = `${project.name} ${project.directory}`
							.toLowerCase()
							.includes(filter);
						const sessions = (coding.sessionsByProject[project.id] ?? []).filter(
							(session) => !filter || projectMatches || session.title.toLowerCase().includes(filter)
						);
						return (
							<section key={project.id} className="mb-2" aria-label={project.name}>
								<div className="flex items-center gap-0.5">
									<Button
										variant="ghost"
										size="icon-sm"
										className="size-6 shrink-0"
										aria-label={`Toggle ${project.name} sessions`}
										aria-expanded={expanded}
										onClick={() =>
											setCollapsed((current) =>
												current.includes(project.id)
													? current.filter((id) => id !== project.id)
													: [...current, project.id]
											)
										}
									>
										<ChevronRight
											className={`size-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
										/>
									</Button>
									<Button
										variant={coding.projectId === project.id ? 'secondary' : 'ghost'}
										className="h-8 min-w-0 flex-1 justify-start px-1.5 text-xs font-normal"
										title={project.directory}
										disabled={coding.busy || !project.available}
										onClick={() => onSelect(project.id)}
									>
										<Folder
											className={`size-3.5 shrink-0 ${project.available ? '' : 'text-destructive'}`}
										/>
										<span className="truncate">{project.name}</span>
									</Button>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												className="size-7 shrink-0"
												aria-label={`${project.name} options`}
												disabled={coding.busy || coding.loading}
											>
												<MoreHorizontal className="size-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												disabled={!project.available}
												onSelect={() => onSelect(project.id, undefined, true)}
											>
												<Plus />
												New session
											</DropdownMenuItem>
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
											<DropdownMenuSeparator />
											<DropdownMenuItem
												className="text-destructive"
												onSelect={() => {
													if (onBeforeChange()) void coding.removeProject(project.id);
												}}
											>
												<Trash2 />
												Remove workspace
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
								{expanded && (
									<div className="ml-6 mt-1 space-y-0.5">
										{sessions.map((session) => (
											<Button
												key={session.id}
												variant={session.id === coding.snapshot?.session.id ? 'secondary' : 'ghost'}
												className="h-7 w-full justify-start px-2 text-xs font-normal"
												aria-current={
													session.id === coding.snapshot?.session.id ? 'page' : undefined
												}
												title={session.title}
												disabled={coding.busy}
												onClick={() => onSelect(project.id, session.id)}
											>
												<span className="truncate">{session.title || 'Untitled session'}</span>
											</Button>
										))}
										{!sessions.length && (
											<p className="px-2 py-1 text-xs text-muted-foreground">
												{project.available ? 'No sessions yet.' : 'Folder unavailable.'}
											</p>
										)}
									</div>
								)}
							</section>
						);
					})}
			</nav>
		</aside>
	);
}
