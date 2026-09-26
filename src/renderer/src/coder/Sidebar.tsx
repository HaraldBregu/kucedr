import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
	Check,
	FileText,
	Folder,
	FolderOpen,
	FolderPlus,
	MoreVertical,
	Plus,
	Search,
	Settings,
	Trash2,
} from 'lucide-react';
import { SPLIT_ITEM_ACTIVE_CLASS, SPLIT_ITEM_CLASS } from '@/components/app/base/page';
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from '@/components/app/base/page/context/state';
import { Input } from '@/components/ui/input';
import {
	SidebarFooter,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Workspace } from './workspace';

export function Sidebar({
	coding,
	width,
	onWidthChange,
	onSelect,
	onInstructions,
	onBeforeChange,
	onConfiguration,
	settingsActive,
}: {
	coding: Workspace;
	width: number;
	onWidthChange: (width: number) => void;
	onBeforeChange: () => boolean;
	onSelect: (projectId: string, sessionId?: string, fresh?: boolean) => void;
	onInstructions: (projectId: string) => void;
	onConfiguration: () => void;
	settingsActive: boolean;
}) {
	const [query, setQuery] = useState('');
	const [searchOpen, setSearchOpen] = useState(false);
	const searchInput = useRef<HTMLInputElement>(null);
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

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target;
			if (
				event.key !== '/' ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey ||
				(target instanceof HTMLElement &&
					(target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)))
			)
				return;
			event.preventDefault();
			setSearchOpen(true);
			window.requestAnimationFrame(() => searchInput.current?.focus());
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	return (
		<aside
			aria-label="Sessions"
			data-slot="coder-sidebar"
			className="absolute inset-y-0 left-0 z-20 flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-background text-sidebar-foreground md:relative md:w-[var(--coder-sidebar-width)]"
			style={{ '--coder-sidebar-width': `${width}px` } as CSSProperties}
		>
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
					<SidebarMenuItem>
						<SidebarMenuButton
							type="button"
							className="px-2.5 text-sm"
							aria-label="Search projects and sessions"
							aria-expanded={searchOpen}
							onClick={() => {
								setSearchOpen((open) => !open);
								setQuery('');
							}}
						>
							<Search className="size-4 shrink-0" />
							<span className="truncate">Search</span>
							<kbd className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground opacity-0 group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100">
								/
							</kbd>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				{searchOpen && (
					<Input
						ref={searchInput}
						autoFocus
						aria-label="Search projects and sessions"
						placeholder="Search sessions…"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						className="mt-2 h-8 text-xs"
					/>
				)}
			</header>
			<section
				className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2 pt-3"
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
				<nav aria-label="Projects and sessions">
					{projects.map((item) => {
						const projectMatches = `${item.name} ${item.directory}`.toLowerCase().includes(filter);
						const sessions = (coding.sessionsByProject[item.id] ?? []).filter(
							(session) => !filter || projectMatches || session.title.toLowerCase().includes(filter)
						);
						return (
							<div key={item.id}>
								{filter && (
									<div className="px-2 py-1 text-xs text-muted-foreground">{item.name}</div>
								)}
								<ul className="flex min-w-0 flex-col gap-1">
									{sessions.map((session) => {
										const active = session.id === coding.snapshot?.session.id;
										return (
											<li key={session.id} className="flex min-w-0 items-center">
												<button
													type="button"
													aria-current={active ? 'page' : undefined}
													title={session.title}
													disabled={coding.busy || !item.available}
													className={cn(
														SPLIT_ITEM_CLASS,
														'min-w-0 flex-1 disabled:pointer-events-none disabled:opacity-50',
														active && SPLIT_ITEM_ACTIVE_CLASS
													)}
													onClick={() => onSelect(item.id, session.id)}
												>
													<span>{session.title || 'Untitled session'}</span>
												</button>
											</li>
										);
									})}
								</ul>
								{!sessions.length && !filter && (
									<p className="px-2 py-1 text-xs text-muted-foreground">
										{item.available ? 'No sessions yet.' : 'Folder unavailable.'}
									</p>
								)}
							</div>
						);
					})}
				</nav>
			</section>
			<SidebarFooter className="shrink-0 border-t border-sidebar-border/50">
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									aria-label="Project menu"
									data-active={settingsActive}
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
										<Folder className="size-4" />
									</span>
									<span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">
											{project?.name ?? 'Choose project'}
										</span>
										<span className="truncate text-xs text-muted-foreground">
											{project?.directory ?? 'Open a folder to start coding'}
										</span>
									</span>
									<MoreVertical className="ml-auto size-4" aria-hidden="true" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-[var(--radix-dropdown-menu-trigger-width)]"
								side="top"
								align="start"
							>
								<DropdownMenuLabel className="p-0 font-normal">
									<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
										<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
											<Folder className="size-4" />
										</span>
										<div className="grid min-w-0 flex-1 text-left text-xs leading-tight">
											<span className="truncate font-medium">
												{project?.name ?? 'Choose project'}
											</span>
											<span className="truncate text-muted-foreground">{project?.directory}</span>
										</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
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
								<DropdownMenuItem
									disabled={coding.busy || coding.loading}
									onSelect={() => {
										if (onBeforeChange()) void coding.addProject();
									}}
								>
									<FolderPlus />
									Open project folder
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{project && (
									<>
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
									</>
								)}
								<DropdownMenuItem
									onSelect={onConfiguration}
									aria-current={settingsActive ? 'page' : undefined}
								>
									<Settings />
									Settings
								</DropdownMenuItem>
								{project && (
									<>
										<DropdownMenuSeparator />
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
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<button
				type="button"
				data-slot="coder-sidebar-resizer"
				role="separator"
				aria-label="Resize sidebar"
				aria-orientation="vertical"
				aria-valuemin={MIN_SIDEBAR_WIDTH}
				aria-valuemax={MAX_SIDEBAR_WIDTH}
				aria-valuenow={width}
				tabIndex={0}
				title="Resize sidebar"
				className="absolute inset-y-0 -right-1.5 z-20 hidden w-3 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 hover:after:bg-sidebar-border focus-visible:after:bg-ring md:block"
				onKeyDown={(event) => {
					if (event.key === 'ArrowLeft') {
						event.preventDefault();
						onWidthChange(width - 8);
					}
					if (event.key === 'ArrowRight') {
						event.preventDefault();
						onWidthChange(width + 8);
					}
					if (event.key === 'Home') {
						event.preventDefault();
						onWidthChange(MIN_SIDEBAR_WIDTH);
					}
					if (event.key === 'End') {
						event.preventDefault();
						onWidthChange(MAX_SIDEBAR_WIDTH);
					}
				}}
				onPointerDown={(event) => {
					if (event.button !== 0) return;
					event.preventDefault();
					const startX = event.clientX;
					const startWidth = width;
					const previousCursor = document.body.style.cursor;
					const previousUserSelect = document.body.style.userSelect;
					document.body.style.cursor = 'col-resize';
					document.body.style.userSelect = 'none';

					const handlePointerMove = (moveEvent: PointerEvent): void => {
						onWidthChange(startWidth + moveEvent.clientX - startX);
					};
					const stopResizing = (): void => {
						window.removeEventListener('pointermove', handlePointerMove);
						window.removeEventListener('pointerup', stopResizing);
						window.removeEventListener('pointercancel', stopResizing);
						document.body.style.cursor = previousCursor;
						document.body.style.userSelect = previousUserSelect;
					};

					window.addEventListener('pointermove', handlePointerMove);
					window.addEventListener('pointerup', stopResizing);
					window.addEventListener('pointercancel', stopResizing);
				}}
			/>
		</aside>
	);
}
