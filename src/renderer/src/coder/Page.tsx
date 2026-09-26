import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { Code2, FolderPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatContainerContent, ChatContainerRoot } from '@/components/ui/chat-container';
import { useAppTheme } from '@/components/app/navigationbar/hooks/useAppTheme';
import { Transcript } from './Transcript';
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
	const location = useLocation();
	const navigate = useNavigate();
	const [sidebar, setSidebar] = useState(() => window.innerWidth >= 768);
	const [instructionsDirty, setInstructionsDirty] = useState(false);
	const instructionsDirtyRef = useRef(instructionsDirty);
	instructionsDirtyRef.current = instructionsDirty;
	const previousPath = useRef(location.pathname);
	const blocker = useBlocker(
		({ currentLocation, nextLocation }) =>
			instructionsDirtyRef.current &&
			currentLocation.pathname === '/instructions' &&
			currentLocation.pathname !== nextLocation.pathname
	);
	const project = coding.projects.find((item) => item.id === coding.projectId);
	const leaveInstructions = () => {
		if (!instructionsDirtyRef.current) return true;
		if (!window.confirm('Discard unsaved changes to agent instructions?')) return false;
		instructionsDirtyRef.current = false;
		setInstructionsDirty(false);
		return true;
	};
	const openPage = (path: '/' | '/settings' | '/instructions') => {
		if (path === location.pathname || !leaveInstructions()) return;
		void navigate(path);
	};
	const select = (projectId: string, sessionId?: string, fresh?: boolean) => {
		if (!leaveInstructions()) return;
		void navigate('/');
		void coding.select(projectId, sessionId, fresh);
		if (window.innerWidth < 768) setSidebar(false);
	};
	useEffect(() => {
		if (blocker.state !== 'blocked') return;
		if (leaveInstructions()) blocker.proceed();
		else blocker.reset();
	}, [blocker]);
	useEffect(() => {
		if (previousPath.current === '/settings' && location.pathname !== '/settings')
			void coding.refreshSettings();
		previousPath.current = location.pathname;
	}, [location.pathname, coding]);
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
				!instructionsDirtyRef.current
			) {
				event.preventDefault();
				void navigate('/');
				void coding.select(project.id, undefined, true);
			}
			if ((event.metaKey || event.ctrlKey) && event.key === '/' && location.pathname === '/') {
				event.preventDefault();
				document.getElementById('coder-composer')?.focus();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [coding, project, location.pathname, navigate]);
	return (
		<div className="flex h-dvh min-h-0 flex-col bg-background pt-12 text-foreground">
			<Navigation
				projectName={project?.name}
				runtime={coding.settings?.runtime}
				projectDirectory={
					coding.snapshot?.session.workingDirectory ??
					project?.directory ??
					coding.settings?.workingDirectory
				}
				sidebar={sidebar}
				onToggleSidebar={() => setSidebar(!sidebar)}
			/>
			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				{sidebar && (
					<Sidebar
						coding={coding}
						onBeforeChange={leaveInstructions}
						onSelect={select}
						onConfiguration={() => openPage('/settings')}
						onInstructions={(id) => {
							if (!leaveInstructions()) return;
							if (id !== coding.projectId) void coding.select(id);
							void navigate('/instructions');
							if (window.innerWidth < 768) setSidebar(false);
						}}
					/>
				)}
				<main className="flex min-w-0 flex-1 flex-col">
					<Routes>
						<Route
							path="/settings"
							element={
								<Configuration
									initial={coding.settings}
									session={coding.snapshot?.session}
									onDone={() => openPage('/')}
								/>
							}
						/>
						<Route
							path="/instructions"
							element={
								project ? (
									<Instructions
										key={`${project.id}:${coding.settings?.runtime}`}
										runtime={coding.settings?.runtime}
										projectId={project.id}
										projectName={project.name}
										onDirtyChange={setInstructionsDirty}
										onDone={() => openPage('/')}
									/>
								) : (
									<Navigate to="/" replace />
								)
							}
						/>
						<Route path="/" element={
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
												<Button variant="outline" onClick={() => openPage('/settings')}>
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
							<Composer coding={coding} onConfiguration={() => openPage('/settings')} />
						</>
						} />
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</main>
			</div>
		</div>
	);
}
