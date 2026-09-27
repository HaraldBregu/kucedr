import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Navigate, Route, Routes, useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import {
	DEFAULT_SIDEBAR_WIDTH,
	MAX_SIDEBAR_WIDTH,
	MIN_SIDEBAR_WIDTH,
} from '@/components/app/base/page/context/state';
import { useAppTheme } from '@/components/app/navigationbar/hooks/useAppTheme';
import { Chat } from './Chat';
import { Navigation } from './Navigation';
import { Sidebar } from './Sidebar';
import { Sessions } from './Sessions';
import { WorkspaceMenu } from './WorkspaceMenu';
import { Resize } from './Resize';
import { Configuration } from './Configuration';
import { Instructions } from './Instructions';
import { Markdown } from './Markdown';
import { useWorkspace } from './workspace';

const RIGHT_MIN_WIDTH = 360;
const RIGHT_MAX_WIDTH = 720;

export function CoderPage() {
	useAppTheme();
	const coding = useWorkspace();
	const location = useLocation();
	const navigate = useNavigate();
	const [sidebar, setSidebar] = useState(() => window.innerWidth >= 768);
	const [viewer, setViewer] = useState(true);
	const [viewerWidth, setViewerWidth] = useState(400);
	const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
	const [layoutReady, setLayoutReady] = useState(false);
	const [instructionsDirty, setInstructionsDirty] = useState(false);
	const [markdownDirty, setMarkdownDirty] = useState(false);
	const markdownDirtyRef = useRef(false);
	const [markdownFiles, setMarkdownFiles] = useState<string[]>([]);
	const [activeMarkdown, setActiveMarkdown] = useState<string | null>(null);
	const [markdownError, setMarkdownError] = useState('');
	const instructionsDirtyRef = useRef(instructionsDirty);
	const previousPath = useRef(location.pathname);
	const skipSettingsRefresh = useRef(false);
	const blocker = useBlocker(
		({ currentLocation, nextLocation }) =>
			currentLocation.pathname !== nextLocation.pathname &&
			((instructionsDirtyRef.current && currentLocation.pathname === '/instructions') ||
				(markdownDirtyRef.current && currentLocation.pathname === '/'))
	);
	const project = coding.projects.find((item) => item.id === coding.projectId);
	useEffect(() => {
		markdownDirtyRef.current = markdownDirty;
	}, [markdownDirty]);
	useEffect(() => {
		let active = true;
		setMarkdownFiles([]);
		setActiveMarkdown(null);
		setMarkdownError('');
		if (project?.available)
			void window.coder
				.listMarkdownFiles(project.id)
				.then((files) => {
					if (active) setMarkdownFiles(files);
				})
				.catch((cause) => {
					if (active) setMarkdownError(String(cause));
				});
		return () => {
			active = false;
		};
	}, [project?.id, project?.available]);
	useEffect(() => {
		let active = true;
		void window.coder
			.getLayout()
			.then((layout) => {
				if (!active || !layout) return;
				setSidebar(layout.sidebarOpen);
				setViewer(layout.viewerOpen);
				setSidebarWidth(
					Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, layout.sidebarWidth))
				);
				setViewerWidth(Math.min(RIGHT_MAX_WIDTH, Math.max(RIGHT_MIN_WIDTH, layout.viewerWidth)));
			})
			.catch((error) => console.error('Could not load Coder layout:', error))
			.finally(() => {
				if (active) setLayoutReady(true);
			});
		return () => {
			active = false;
		};
	}, []);
	useEffect(() => {
		if (!layoutReady) return;
		const timer = window.setTimeout(() => {
			void window.coder
				.saveLayout({ sidebarOpen: sidebar, viewerOpen: viewer, sidebarWidth, viewerWidth })
				.catch((error) => console.error('Could not save Coder layout:', error));
		}, 150);
		return () => window.clearTimeout(timer);
	}, [layoutReady, sidebar, viewer, sidebarWidth, viewerWidth]);
	useEffect(() => {
		instructionsDirtyRef.current = instructionsDirty;
	}, [instructionsDirty]);
	const leaveInstructions = () => {
		if (!instructionsDirtyRef.current) return true;
		if (!window.confirm('Discard unsaved changes to agent instructions?')) return false;
		instructionsDirtyRef.current = false;
		setInstructionsDirty(false);
		return true;
	};
	const leaveEditor = () => {
		if (!leaveInstructions()) return false;
		if (!markdownDirtyRef.current) return true;
		if (!window.confirm('Discard unsaved Markdown changes?')) return false;
		markdownDirtyRef.current = false;
		setMarkdownDirty(false);
		return true;
	};
	const openPage = (path: '/' | '/settings' | '/instructions') => {
		if (path === location.pathname || !leaveEditor()) return;
		if (path === '/') setActiveMarkdown(null);
		void navigate(path);
	};
	const select = (projectId: string, sessionId?: string, fresh?: boolean) => {
		if (projectId !== coding.projectId) {
			if (!leaveEditor()) return;
			setActiveMarkdown(null);
		} else if (!leaveInstructions()) return;
		void navigate('/');
		void coding.select(projectId, sessionId, fresh);
	};
	const openInstructions = (id: string) => {
		if (!leaveEditor()) return;
		if (id !== coding.projectId) void coding.select(id);
		void navigate('/instructions');
		if (window.innerWidth < 1280) setViewer(false);
	};
	useEffect(() => {
		if (blocker.state !== 'blocked') return;
		if (leaveEditor()) blocker.proceed();
		else blocker.reset();
	});
	useEffect(() => {
		if (previousPath.current === '/settings' && location.pathname !== '/settings') {
			if (!skipSettingsRefresh.current) void coding.refreshSettings();
			skipSettingsRefresh.current = false;
		}
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
				sidebar={sidebar}
				viewer={viewer}
				workspaceMenu={
					<WorkspaceMenu
						coding={coding}
						settingsActive={location.pathname === '/settings'}
						onBeforeChange={leaveEditor}
						onSelect={select}
						onConfiguration={() => openPage('/settings')}
						onInstructions={openInstructions}
					/>
				}
				busy={coding.busy}
				canRun={
					location.pathname === '/' &&
					!coding.loading &&
					Boolean(project?.available || coding.settings?.workingDirectory) &&
					Boolean(coding.input.trim()) &&
					(coding.mode === 'shell' || Boolean(coding.settings?.modelId))
				}
				onRun={() => void coding.send()}
				onStop={() => void coding.cancel()}
				onToggleSidebar={() => {
					setSidebar(!sidebar);
					if (window.innerWidth < 1280) setViewer(false);
				}}
				onToggleViewer={() => {
					setViewer(!viewer);
					if (window.innerWidth < 768) setSidebar(false);
				}}
			/>
			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				{sidebar && (
					<Sidebar
						coding={coding}
						width={sidebarWidth}
						onWidthChange={(width) =>
							setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width)))
						}
						markdownFiles={markdownFiles}
						activeMarkdown={location.pathname === '/' ? activeMarkdown : null}
						markdownError={markdownError}
						onMarkdown={(filePath) => {
							if (activeMarkdown === filePath && location.pathname === '/') return;
							if (!leaveEditor()) return;
							setActiveMarkdown(filePath);
							void navigate('/');
							if (window.innerWidth < 768) setSidebar(false);
						}}
						onCreateMarkdown={() => {
							if (!project?.available) return;
							const entered = window.prompt('Markdown file name');
							if (!entered) return;
							const name = entered.trim().toLowerCase().endsWith('.md')
								? entered.trim()
								: `${entered.trim()}.md`;
							if (!name.trim() || name.includes('/') || name.includes('\\') || name === '.md') {
								setMarkdownError('Enter a Markdown file name without folders.');
								return;
							}
							const wasDirty = markdownDirtyRef.current;
							if (!leaveEditor()) return;
							void window.coder
								.createMarkdownFile(project.id, name)
								.then(() => window.coder.listMarkdownFiles(project.id))
								.then((files) => {
									setMarkdownFiles(files);
									setActiveMarkdown(name);
									setMarkdownError('');
									void navigate('/');
								})
								.catch((cause) => {
									if (wasDirty) {
										markdownDirtyRef.current = true;
										setMarkdownDirty(true);
									}
									setMarkdownError(String(cause));
								});
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
									onDone={(settings) => {
										skipSettingsRefresh.current = true;
										void coding.refreshSettings(settings?.runtime);
										openPage('/');
									}}
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
								) : coding.loading ? (
									<p role="status" className="p-4 text-sm text-muted-foreground">
										Loading project…
									</p>
								) : (
									<Navigate to="/" replace />
								)
							}
						/>
						<Route
							path="/"
							element={
								activeMarkdown && project ? (
									<Markdown
										key={`${project.id}:${activeMarkdown}`}
										projectId={project.id}
										filePath={activeMarkdown}
										onDirtyChange={setMarkdownDirty}
									/>
								) : (
									<div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
										<FileText className="size-7" />
										<p className="text-sm">Select or create a workspace instruction file.</p>
									</div>
								)
							}
						/>
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</main>
				{viewer && (
					<aside
						aria-label="Sessions and chat"
						className="absolute inset-y-0 right-0 z-20 flex w-[min(85vw,400px)] flex-col border-l border-sidebar-border bg-background text-sidebar-foreground xl:relative xl:z-10 xl:w-[var(--coder-viewer-width)] xl:shrink-0"
						style={{ '--coder-viewer-width': `${viewerWidth}px` } as CSSProperties}
					>
						<div className="flex h-52 min-h-0 shrink-0 flex-col border-b border-sidebar-border/50">
							<Sessions
								coding={coding}
								onSelect={select}
							/>
						</div>
						<Chat coding={coding} onConfiguration={() => openPage('/settings')} />
						<Resize
							side="left"
							width={viewerWidth}
							minWidth={RIGHT_MIN_WIDTH}
							maxWidth={RIGHT_MAX_WIDTH}
							label="Resize chat sidebar"
							className="xl:block"
							onWidthChange={(width) =>
								setViewerWidth(Math.min(RIGHT_MAX_WIDTH, Math.max(RIGHT_MIN_WIDTH, width)))
							}
						/>
					</aside>
				)}
			</div>
		</div>
	);
}
