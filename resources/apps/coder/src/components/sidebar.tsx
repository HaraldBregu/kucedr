import { ChevronRight, FolderGit2, FolderPlus, Search, Settings } from 'lucide-react';
import type { CSSProperties } from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { SidebarContent, SidebarHeader } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CodingController } from '@/controller';

export function ProjectSidebar({
	coder,
	configurationOpen,
	onOpenConfiguration,
	onOpenWorkspace,
}: {
	coder: CodingController;
	configurationOpen: boolean;
	onOpenConfiguration: () => void;
	onOpenWorkspace: () => boolean;
}) {
	const query = coder.query.trim().toLowerCase();
	const visibleProjects = coder.projects.filter((project) => {
		const projectMatches = `${project.name} ${project.directory}`.toLowerCase().includes(query);
		const sessionMatches = (coder.sessionsByProject[project.id] ?? []).some((session) =>
			session.title.toLowerCase().includes(query)
		);
		return !query || projectMatches || sessionMatches;
	});

	return (
		<>
			<div
				aria-hidden="true"
				className="h-12 shrink-0 border-b border-sidebar-border/50"
				style={{ WebkitAppRegion: 'drag' } as CSSProperties}
			/>
			<SidebarHeader className="px-2 pb-2 pt-2">
				<div className="flex min-h-9 items-center gap-1 group-data-[state=collapsed]/sidebar:flex-col">
					<div className="flex min-w-0 flex-1 items-center gap-2 group-data-[state=collapsed]/sidebar:hidden">
						<FolderGit2 className="size-4 text-muted-foreground" />
						<span className="truncate text-xs font-medium">Coder</span>
					</div>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									variant="ghost"
									size="icon-sm"
									className="group-data-[state=collapsed]/sidebar:mx-auto"
									aria-label="Add workspace folder"
									disabled={coder.busy || coder.runState === 'running'}
									onClick={() => {
										if (onOpenWorkspace()) void coder.addProject();
									}}
								>
									<FolderPlus />
								</Button>
							}
						/>
						<TooltipContent>Add workspace</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									variant={configurationOpen ? 'secondary' : 'ghost'}
									size="icon-sm"
									className="group-data-[state=collapsed]/sidebar:mx-auto"
									aria-label="Open Coder configuration"
									onClick={onOpenConfiguration}
								>
									<Settings />
								</Button>
							}
						/>
						<TooltipContent>Configuration</TooltipContent>
					</Tooltip>
				</div>
				<div className="relative group-data-[state=collapsed]/sidebar:hidden">
					<Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
					<Input
						id="coding-sidebar-search"
						aria-label="Search workspaces and sessions"
						value={coder.query}
						onChange={(event) => coder.setQuery(event.target.value)}
						placeholder="Search"
						className="h-8 border-0 bg-sidebar-accent/60 pl-8 shadow-none focus-visible:ring-1"
					/>
				</div>
			</SidebarHeader>

			<SidebarContent aria-busy={coder.busy}>
				<nav aria-label="Coder workspaces and sessions" className="px-2 pb-2">
					<ul className="space-y-0.5">
						{visibleProjects.map((project) => {
							const sessions = coder.sessionsByProject[project.id] ?? [];
							const filteredSessions = query
								? sessions.filter((session) => session.title.toLowerCase().includes(query))
								: sessions;
							const expanded = Boolean(query) || coder.expandedProjectIds.includes(project.id);

							return (
								<li key={project.id}>
									<Collapsible open={expanded} onOpenChange={() => coder.toggleProject(project.id)}>
										<div className="flex items-center gap-0.5">
											<CollapsibleTrigger
												className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[state=collapsed]/sidebar:hidden"
												aria-label={`${expanded ? 'Collapse' : 'Expand'} ${project.name}`}
											>
												<ChevronRight
													className={`size-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
												/>
											</CollapsibleTrigger>
											<Tooltip>
												<TooltipTrigger
													render={
														<Button
															variant={project.id === coder.activeProjectId ? 'secondary' : 'ghost'}
															className="h-8 min-w-0 flex-1 justify-start gap-2 px-2 text-left font-normal group-data-[state=collapsed]/sidebar:size-8 group-data-[state=collapsed]/sidebar:p-0"
															aria-current={
																project.id === coder.activeProjectId ? 'location' : undefined
															}
															disabled={coder.runState === 'running'}
															onClick={() => {
																if (!onOpenWorkspace()) return;
																void coder.selectProject(project.id);
															}}
														>
															<FolderGit2
																className={`size-3.5 ${project.available ? '' : 'text-destructive'}`}
															/>
															<span className="truncate text-xs group-data-[state=collapsed]/sidebar:hidden">
																{project.name}
															</span>
														</Button>
													}
												/>
												<TooltipContent>
													{project.available ? project.directory : 'Unavailable'}
												</TooltipContent>
											</Tooltip>
										</div>

										<CollapsibleContent className="group-data-[state=collapsed]/sidebar:hidden">
											<ul className="ml-7 space-y-0.5 py-0.5">
												{filteredSessions.map((session) => (
													<li key={session.id}>
														<Button
															variant={session.id === coder.activeSessionId ? 'secondary' : 'ghost'}
															className="h-7 w-full justify-start px-2 text-left text-[11px] font-normal"
															aria-current={
																session.id === coder.activeSessionId ? 'page' : undefined
															}
															disabled={coder.runState === 'running'}
															onClick={() => {
																if (!onOpenWorkspace()) return;
																void coder.selectSession(project.id, session.id);
															}}
														>
															<span className="truncate">{session.title}</span>
														</Button>
													</li>
												))}
											</ul>
										</CollapsibleContent>
									</Collapsible>
								</li>
							);
						})}
					</ul>
				</nav>
			</SidebarContent>
		</>
	);
}
