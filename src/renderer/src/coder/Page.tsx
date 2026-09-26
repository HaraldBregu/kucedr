import { useEffect, useState } from 'react';
import { Code2, FolderPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatContainerContent, ChatContainerRoot } from '@/components/ui/chat-container';
import { useAppTheme } from '@/components/app/navigationbar/hooks/useAppTheme';
import { Transcript } from './Transcript';
import { Viewer } from './Viewer';
import { Navigation } from './Navigation';
import { Sidebar } from './Sidebar';
import { Composer } from './Composer';
import { Configuration } from './Configuration';
import { Interaction } from './Interaction';
import { Instructions } from './Instructions';
import { useWorkspace } from './workspace';

export function CoderPage() {
	useAppTheme();
	const coding = useWorkspace();
	const [sidebar, setSidebar] = useState(() => window.innerWidth >= 768);
	const [viewer, setViewer] = useState(() => window.innerWidth >= 1280);
	const [page, setPage] = useState<'chat' | 'configuration' | 'instructions'>('chat');
	const [instructionsDirty, setInstructionsDirty] = useState(false);
	const project = coding.projects.find((item) => item.id === coding.projectId);
	const leaveInstructions = () =>
		!instructionsDirty || window.confirm('Discard unsaved changes to agent instructions?');
	const openPage = (next: typeof page) => {
		if (next === page || !leaveInstructions()) return;
		if (page === 'configuration') void coding.refreshSettings();
		setInstructionsDirty(false);
		setPage(next);
	};
	const select = (projectId: string, sessionId?: string, fresh?: boolean) => {
		if (!leaveInstructions()) return;
		if (page === 'configuration') void coding.refreshSettings();
		setInstructionsDirty(false);
		setPage('chat');
		void coding.select(projectId, sessionId, fresh);
		if (window.innerWidth < 768) setSidebar(false);
	};
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (
				event.ctrlKey &&
				!event.metaKey &&
				event.key.toLowerCase() === 'c' &&
				coding.busy &&
				!window.getSelection()?.toString()
			) {
				event.preventDefault();
				void coding.cancel();
			}
			if (
				(event.metaKey || event.ctrlKey) &&
				event.key.toLowerCase() === 'n' &&
				project &&
				!coding.busy &&
				!coding.loading &&
				!instructionsDirty
			) {
				event.preventDefault();
				setPage('chat');
				void coding.select(project.id, undefined, true);
			}
			if ((event.metaKey || event.ctrlKey) && event.key === '/' && page === 'chat') {
				event.preventDefault();
				document.getElementById('coder-composer')?.focus();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [coding, project, instructionsDirty, page]);
	return (
		<div className="flex h-dvh min-h-0 flex-col bg-background pt-12 text-foreground">
			<Navigation
				projectName={project?.name}
				sidebar={sidebar}
				viewer={viewer}
				onToggleSidebar={() => {
					setSidebar(!sidebar);
					if (window.innerWidth < 1280) setViewer(false);
				}}
				onToggleViewer={() => {
					setViewer(!viewer);
					if (window.innerWidth < 768) setSidebar(false);
				}}
				onConfiguration={() => openPage('configuration')}
				configurationDisabled={coding.busy}
			/>
			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				{sidebar && (
					<Sidebar
						coding={coding}
						onBeforeChange={leaveInstructions}
						onSelect={select}
						onInstructions={(id) => {
							if (!leaveInstructions()) return;
							setInstructionsDirty(false);
							if (id !== coding.projectId) void coding.select(id);
							setPage('instructions');
							if (window.innerWidth < 768) setSidebar(false);
						}}
					/>
				)}
				<main className="flex min-w-0 flex-1 flex-col">
					{page === 'configuration' ? (
						<Configuration
							initial={coding.settings}
							session={coding.snapshot?.session}
							onDone={(settings) => {
								void coding.refreshSettings(settings?.runtime);
								setPage('chat');
							}}
						/>
					) : page === 'instructions' && project ? (
						<Instructions
							key={`${project.id}:${coding.settings?.runtime}`}
							runtime={coding.settings?.runtime}
							projectId={project.id}
							projectName={project.name}
							onDirtyChange={setInstructionsDirty}
							onDone={() => openPage('chat')}
						/>
					) : (
						<>
							<div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
								<h2 className="min-w-0 flex-1 truncate text-sm font-medium">
									{coding.snapshot?.session.title || 'New session'}
								</h2>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="New session"
									title="New session · ⌘/Ctrl N"
									disabled={!project?.available || coding.busy || coding.loading}
									onClick={() => project && select(project.id, undefined, true)}
								>
									<Plus className="size-4" />
								</Button>
							</div>
							<ChatContainerRoot className="min-h-0">
								<ChatContainerContent className="mx-auto max-w-3xl p-4">
									{coding.loading ? (
										<p role="status" className="text-sm text-muted-foreground">
											Loading…
										</p>
									) : coding.blocks.length ? (
										<Transcript blocks={coding.blocks} />
									) : (
										<div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
											<Code2 className="size-7 text-muted-foreground" />
											<h2 className="text-lg font-semibold">
												{project ? 'What are we building?' : 'Open a project'}
											</h2>
											<p className="text-sm text-muted-foreground">
												{project
													? 'Start with a prompt or switch to Command.'
													: 'Choose a folder to start coding.'}
											</p>
											{!project && (
												<Button variant="outline" onClick={() => void coding.addProject()}>
													<FolderPlus className="size-4" />
													Choose folder
												</Button>
											)}
											{project && !coding.settings?.modelId && (
												<Button variant="outline" onClick={() => openPage('configuration')}>
													Configure agent
												</Button>
											)}
										</div>
									)}
									{coding.interactions.map((item) => (
										<Interaction key={item.requestId} request={item} onRespond={coding.respond} />
									))}
									{coding.busy && (
										<p role="status" className="mt-4 text-xs text-muted-foreground">
											{coding.status}
										</p>
									)}
									{coding.error && (
										<p role="alert" className="mt-4 text-sm text-destructive">
											{coding.error}
										</p>
									)}
								</ChatContainerContent>
							</ChatContainerRoot>
							<Composer coding={coding} onConfiguration={() => openPage('configuration')} />
						</>
					)}
				</main>
				{viewer && (
					<div className="absolute inset-y-0 right-0 z-10 w-[min(85vw,400px)] border-l xl:static xl:w-[35%] xl:max-w-xl">
						<Viewer
							key={coding.projectId}
							projectId={coding.projectId}
							snapshot={coding.snapshot}
							revision={coding.revision}
							busy={coding.busy}
							onInstructions={() => openPage('instructions')}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
