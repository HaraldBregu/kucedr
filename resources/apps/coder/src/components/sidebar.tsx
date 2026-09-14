import { FileText, Files, Folder, Info } from 'lucide-react';
import type { CSSProperties } from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { SidebarContent } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CodingController } from '@/controller';

export function ProjectSidebar({
	coding,
	onOpenFiles,
	onOpenInstructions,
	onOpenProject,
	onOpenWorkspace,
}: {
	coding: CodingController;
	onOpenFiles: (projectId: string) => void;
	onOpenInstructions: (projectId: string) => void;
	onOpenProject: (projectId: string) => void;
	onOpenWorkspace: () => boolean;
}) {
	const query = coding.query.trim().toLowerCase();
	const visibleProjects = coding.projects.filter((project) => {
		const projectMatches = `${project.name} ${project.directory}`.toLowerCase().includes(query);
		const sessionMatches = (coding.sessionsByProject[project.id] ?? []).some((session) =>
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
			<SidebarContent aria-busy={coding.busy}>
				<nav aria-label="Coder workspaces and sessions" className="px-2 pb-2">
					<ul className="space-y-0.5">
						{visibleProjects.map((project) => {
							const sessions = coding.sessionsByProject[project.id] ?? [];
							const filteredSessions = query
								? sessions.filter((session) => session.title.toLowerCase().includes(query))
								: sessions;
							const expanded = Boolean(query) || coding.expandedProjectIds.includes(project.id);

							return (
								<li key={project.id}>
									<Collapsible open={expanded} onOpenChange={() => coding.toggleProject(project.id)}>
										<div className="flex items-center">
											<Tooltip>
												<TooltipTrigger
													render={
														<Button
															variant={project.id === coding.activeProjectId ? 'secondary' : 'ghost'}
															className="h-8 min-w-0 flex-1 justify-start gap-2 px-2 text-left font-normal group-data-[state=collapsed]/sidebar:size-8 group-data-[state=collapsed]/sidebar:p-0"
															aria-current={
																project.id === coding.activeProjectId ? 'location' : undefined
															}
															disabled={coding.runState === 'running'}
															onClick={() => {
																if (!onOpenWorkspace()) return;
																coding.toggleProject(project.id);
																void coding.selectProject(project.id);
															}}
														>
													<Folder
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
											<ul className="ml-4 space-y-0.5 py-1">
												<li>
													<Button
														variant="ghost"
														className="h-7 w-full justify-start gap-2 px-2 text-left text-[11px] font-normal"
														onClick={() => onOpenInstructions(project.id)}
													>
														<Info /> Project details
													</Button>
												</li>
												<li>
													<Button
														variant="ghost"
														className="h-7 w-full justify-start gap-2 px-2 text-left text-[11px] font-normal"
														disabled={!project.available}
														onClick={() => onOpenFiles(project.id)}
													>
														<Files /> Files
													</Button>
												</li>
												<li>
													<Button
														variant="ghost"
														className="h-7 w-full justify-start gap-2 px-2 text-left text-[11px] font-normal"
														disabled={!project.available}
														onClick={() => onOpenProject(project.id)}
													>
														<FileText /> AGENTS.md
													</Button>
												</li>
												{filteredSessions.length ? (
													<li className="px-2 pb-0.5 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
														Sessions
													</li>
												) : null}
												{filteredSessions.map((session) => (
													<li key={session.id}>
														<Button
															variant={session.id === coding.activeSessionId ? 'secondary' : 'ghost'}
															className="h-7 w-full justify-start px-2 text-left text-[11px] font-normal"
															aria-current={
																session.id === coding.activeSessionId ? 'page' : undefined
															}
															disabled={coding.runState === 'running'}
															onClick={() => {
																if (!onOpenWorkspace()) return;
																void coding.selectSession(project.id, session.id);
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
