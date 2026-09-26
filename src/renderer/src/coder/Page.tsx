import { useState } from 'react';
import { ArrowUp, Code2, FolderPlus, PanelLeft, PanelRight, Plus, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { ChatContainerContent, ChatContainerRoot } from '@/components/ui/chat-container';
import { useAppTheme } from '@/components/app/navigationbar/hooks/useAppTheme';
import { cn } from '@/lib/utils';
import { Transcript } from './Transcript';
import { Viewer } from './Viewer';
import { useWorkspace } from './workspace';

export function CoderPage() {
	useAppTheme();
	const workspace = useWorkspace();
	const [sidebar, setSidebar] = useState(() => window.innerWidth >= 768);
	const [viewer, setViewer] = useState(() => window.innerWidth >= 1280);
	const project = workspace.projects.find((item) => item.id === workspace.projectId);
	const blocks = [...(workspace.snapshot?.blocks ?? [])];
	if (workspace.pending)
		blocks.push({
			id: 'pending',
			type: 'message',
			role: 'user',
			content: workspace.pending,
			timestamp: '',
		});
	if (workspace.output)
		blocks.push({
			id: 'stream',
			type: 'message',
			role: 'assistant',
			content: workspace.output,
			timestamp: '',
		});
	return (
		<div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Toggle sessions"
					aria-expanded={sidebar}
					onClick={() => {
						setSidebar(!sidebar);
						if (window.innerWidth < 1280) setViewer(false);
					}}
				>
					<PanelLeft className="size-4" />
				</Button>
				<Code2 className="size-4" />
				<h1 className="text-sm font-semibold">Coder</h1>
				<span className="min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground">
					{project?.name}
				</span>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Toggle content viewer"
					aria-expanded={viewer}
					onClick={() => {
						setViewer(!viewer);
						if (window.innerWidth < 768) setSidebar(false);
					}}
				>
					<PanelRight className="size-4" />
				</Button>
			</header>
			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				{sidebar && (
					<aside
						aria-label="Sessions"
						className="absolute inset-y-0 left-0 z-20 flex w-60 shrink-0 flex-col border-r bg-sidebar p-2 md:static"
					>
						<div className="flex items-center gap-1 pb-3">
							<Select
								value={workspace.projectId}
								disabled={workspace.busy || workspace.loading}
								onValueChange={(value) => value && workspace.setProjectId(value)}
							>
								<SelectTrigger className="min-w-0 flex-1" aria-label="Project">
									<SelectValue placeholder="Select project">
										{project?.name ?? 'Select project'}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{workspace.projects.map((item) => (
										<SelectItem key={item.id} value={item.id} disabled={!item.available}>
											{item.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Open project folder"
								disabled={workspace.busy}
								onClick={() => void workspace.addProject()}
							>
								<FolderPlus className="size-4" />
							</Button>
						</div>
						<Button
							variant="ghost"
							className="w-full justify-start"
							disabled={!project || workspace.busy}
							onClick={() => {
								void workspace.selectSession();
								if (window.innerWidth < 768) setSidebar(false);
							}}
						>
							<Plus className="size-4" />
							New session
						</Button>
						<h2 className="px-2 pb-2 pt-5 text-xs font-medium text-muted-foreground">Sessions</h2>
						<nav className="min-h-0 flex-1 space-y-1 overflow-auto" aria-busy={workspace.loading}>
							{workspace.sessions.map((session) => (
								<Button
									key={session.id}
									variant={session.id === workspace.snapshot?.session.id ? 'secondary' : 'ghost'}
									className="w-full justify-start font-normal"
									disabled={workspace.busy}
									aria-current={session.id === workspace.snapshot?.session.id ? 'page' : undefined}
									title={session.title}
									onClick={() => {
										void workspace.selectSession(session.id);
										if (window.innerWidth < 768) setSidebar(false);
									}}
								>
									<span className="truncate">{session.title || 'Untitled session'}</span>
								</Button>
							))}
							{!workspace.sessions.length && (
								<p className="p-2 text-xs text-muted-foreground">
									{workspace.loading ? 'Loading sessions…' : 'No sessions yet.'}
								</p>
							)}
						</nav>
						{project && (
							<p
								className="truncate px-2 pt-3 text-xs text-muted-foreground"
								title={project.directory}
							>
								{project.directory}
							</p>
						)}
					</aside>
				)}
				<main className="flex min-w-0 flex-1 flex-col">
					<div className="flex h-12 shrink-0 items-center border-b px-5">
						<h2 className="truncate text-sm font-medium">
							{workspace.snapshot?.session.title || 'New session'}
						</h2>
					</div>
					<ChatContainerRoot className="min-h-0">
						<ChatContainerContent className="mx-auto max-w-3xl p-5">
							{blocks.length ? (
								<Transcript blocks={blocks} />
							) : (
								<div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
									<Code2 className="size-8 text-muted-foreground" />
									<h2 className="text-xl font-semibold">What are we building?</h2>
									<p className="text-sm text-muted-foreground">
										{project
											? 'Ask Coder to explore, build, or fix something in your project.'
											: 'Open a project folder to start coding.'}
									</p>
									{!project && (
										<Button variant="outline" onClick={() => void workspace.addProject()}>
											<FolderPlus className="size-4" />
											Open project
										</Button>
									)}
								</div>
							)}
							{workspace.busy && (
								<p role="status" className="mt-4 text-xs text-muted-foreground">
									{workspace.status}
								</p>
							)}
						</ChatContainerContent>
					</ChatContainerRoot>
					<div className="mx-auto w-full max-w-3xl shrink-0 p-4">
						{workspace.error && (
							<p role="alert" className="mb-3 text-sm text-destructive">
								{workspace.error}
							</p>
						)}
						<form
							className="rounded-xl border bg-card p-2 shadow-sm"
							onSubmit={(event) => {
								event.preventDefault();
								void workspace.send();
							}}
						>
							<Textarea
								aria-label="Message Coder"
								placeholder="Ask Coder…"
								value={workspace.input}
								disabled={!project || workspace.busy || workspace.loading}
								onChange={(event) => workspace.setInput(event.target.value)}
								className="max-h-40 min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
								onKeyDown={(event) => {
									if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
										event.preventDefault();
										void workspace.send();
									}
								}}
							/>
							<div className="flex justify-end">
								{workspace.busy ? (
									<Button
										type="button"
										size="icon-sm"
										aria-label="Stop generation"
										disabled={!workspace.runId}
										onClick={() => void workspace.cancel()}
									>
										<Square className="size-4" />
									</Button>
								) : (
									<Button
										type="submit"
										size="icon-sm"
										aria-label="Send message"
										disabled={!project || workspace.loading || !workspace.input.trim()}
									>
										<ArrowUp className="size-4" />
									</Button>
								)}
							</div>
						</form>
					</div>
				</main>
				{viewer && (
					<div
						className={cn(
							'absolute inset-y-0 right-0 z-10 w-[min(85vw,400px)] border-l xl:static xl:w-[35%] xl:max-w-xl'
						)}
					>
						<Viewer
							projectId={workspace.projectId}
							snapshot={workspace.snapshot}
							revision={workspace.revision}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
