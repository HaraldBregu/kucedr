import { useCallback, useEffect, useRef, useState } from 'react';
import {
	app,
	coder as codingApi,
	isKucedr,
	type CodingProject,
	type CodingResponseEvent,
	type CodingRunMode,
	type CodingSessionBlock,
	type CodingSessionSummary,
	type CodingSettings,
} from '@kucedr/sdk';

import type { CodingBlock, CodingController, RunState } from '@/controller';

const ACTIVE_PROJECT_KEY = 'active-project-id';
const SIDEBAR_OPEN_KEY = 'sidebar-open';
const previewTimestamp = new Date().toISOString();
const previewSettings: CodingSettings = {
	runtime: 'pi',
	providerId: 'openai-codex',
	modelId: 'gpt-5.4',
	thinkingLevel: 'high',
	toolMode: 'coding',
};
const previewProjects: CodingProject[] = [
	{
		id: 'kucedr',
		name: 'kucedr',
		directory: '/workspace/kucedr',
		kind: 'agent-workspace',
		createdAt: previewTimestamp,
		lastOpenedAt: previewTimestamp,
		available: true,
	},
	{
		id: 'website',
		name: 'website',
		directory: '/Users/demo/Projects/website',
		kind: 'external',
		createdAt: previewTimestamp,
		lastOpenedAt: previewTimestamp,
		available: true,
	},
];
const previewSessions: CodingSessionSummary[] = [
	{
		id: 'session-1',
		projectId: 'kucedr',
		title: 'Remember recent commands',
		createdAt: previewTimestamp,
		updatedAt: previewTimestamp,
		messageCount: 5,
	},
];
const previewSessionsByProject = { kucedr: previewSessions, website: [] };
const previewBlocks: CodingBlock[] = [
	{
		id: 'preview-user',
		type: 'message',
		role: 'user',
		content: 'Make the command palette remember the most recently used actions.',
		status: 'complete',
		timestamp: previewTimestamp,
	},
	{
		id: 'preview-tool',
		type: 'tool',
		toolName: 'read',
		status: 'succeeded',
		timestamp: previewTimestamp,
	},
	{
		id: 'preview-assistant',
		type: 'message',
		role: 'assistant',
		content:
			'I kept the change local to the command context and restored recent actions on launch.\n\nThe focused renderer tests pass.',
		status: 'complete',
		timestamp: previewTimestamp,
	},
];

export function useCoderWorkspace(): CodingController {
	const preview = !isKucedr();
	const activeRunIdRef = useRef('');
	const cancelRequestedRef = useRef(false);
	const runningRef = useRef(false);
	const loadSequenceRef = useRef(0);
	const [settings, setSettings] = useState<CodingSettings>(
		preview ? previewSettings : previewSettings
	);
	const [projects, setProjects] = useState<CodingProject[]>(preview ? previewProjects : []);
	const [sessionsByProject, setSessionsByProject] = useState<Record<string, CodingSessionSummary[]>>(
		preview ? previewSessionsByProject : {}
	);
	const [blocks, setBlocks] = useState<CodingBlock[]>(preview ? previewBlocks : []);
	const [activeProjectId, setActiveProjectId] = useState<string | undefined>(
		preview ? 'kucedr' : undefined
	);
	const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
		preview ? 'session-1' : undefined
	);
	const [input, setInput] = useState('');
	const [mode, setMode] = useState<CodingRunMode>('agent');
	const [query, setQuery] = useState('');
	const [runState, setRunState] = useState<RunState>(preview ? 'idle' : 'loading');
	const [runLabel, setRunLabel] = useState(preview ? 'Preview' : 'Loading');
	const [error, setError] = useState('');
	const [leftOpen, setLeftOpen] = useState(true);
	const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>(preview ? ['kucedr'] : []);
	const [busy, setBusy] = useState(!preview);
	const sessions = activeProjectId ? (sessionsByProject[activeProjectId] ?? []) : [];

	const loadProject = useCallback(
		async (projectId: string, preferredSessionId?: string): Promise<void> => {
			if (preview) {
				setActiveProjectId(projectId);
				setActiveSessionId(projectId === 'kucedr' ? 'session-1' : undefined);
				setBlocks(projectId === 'kucedr' ? previewBlocks : []);
				return;
			}
			const sequence = ++loadSequenceRef.current;
			setBusy(true);
			setError('');
			setActiveProjectId(projectId);
			try {
				const nextSessions = await codingApi.listSessions(projectId);
				if (sequence !== loadSequenceRef.current) return;
				setSessionsByProject((current) => ({ ...current, [projectId]: nextSessions }));
				const session =
					nextSessions.find((item) => item.id === preferredSessionId) ?? nextSessions[0];
				if (!session) {
					setActiveSessionId(undefined);
					setBlocks([]);
					return;
				}
				const snapshot = await codingApi.getSession(projectId, session.id);
				if (sequence !== loadSequenceRef.current) return;
				setActiveSessionId(session.id);
				setBlocks(
					snapshot.blocks.map(
						(block: CodingSessionBlock): CodingBlock =>
							block.type === 'message' ? { ...block, status: 'complete' } : block
					)
				);
			} catch (reason) {
				if (sequence !== loadSequenceRef.current) return;
				setError(reason instanceof Error ? reason.message : 'Unable to open this project.');
				setSessionsByProject((current) => ({ ...current, [projectId]: [] }));
				setActiveSessionId(undefined);
				setBlocks([]);
			} finally {
				if (sequence === loadSequenceRef.current) setBusy(false);
			}
		},
		[preview]
	);

	useEffect(() => {
		if (preview) return;
		let active = true;
		void Promise.all([
			codingApi.getSettings(),
			codingApi.listProjects(),
			app.getAppStoreValue<string>(ACTIVE_PROJECT_KEY),
			app.getAppStoreValue<boolean>(SIDEBAR_OPEN_KEY),
		])
			.then(async ([nextSettings, nextProjects, savedProjectId, savedSidebarOpen]) => {
				if (!active) return;
				setSettings(nextSettings);
				setProjects(nextProjects);
				if (typeof savedSidebarOpen === 'boolean') setLeftOpen(savedSidebarOpen);
				const groupedSessions = await Promise.all(
					nextProjects.map(
						async (project) => [project.id, await codingApi.listSessions(project.id)] as const
					)
				);
				if (!active) return;
				setSessionsByProject(Object.fromEntries(groupedSessions));
				const project = nextProjects.find((item) => item.id === savedProjectId) ?? nextProjects[0];
				if (!project) {
					setRunLabel(nextSettings.modelId ? 'Open a project' : 'Setup needed');
					setRunState('idle');
					setBusy(false);
					return;
				}
				setExpandedProjectIds([project.id]);
				await loadProject(project.id);
				if (!active) return;
				setRunLabel(nextSettings.modelId ? 'Ready' : 'Setup needed');
				setRunState('idle');
			})
			.catch((reason) => {
				if (!active) return;
				setError(reason instanceof Error ? reason.message : 'Unable to load Coder.');
				setRunState('error');
				setRunLabel('Unavailable');
				setBusy(false);
			});
		return () => {
			active = false;
		};
	}, [loadProject, preview]);

	useEffect(() => {
		if (!preview && runState !== 'loading') {
			void app.setAppStoreValue(SIDEBAR_OPEN_KEY, leftOpen);
		}
	}, [leftOpen, preview, runState]);

	const newSession = useCallback(
		(projectId = activeProjectId) => {
			if (runningRef.current || !projectId) return;
			setActiveProjectId(projectId);
			setExpandedProjectIds((current) =>
				current.includes(projectId) ? current : [...current, projectId]
			);
			setActiveSessionId(undefined);
			setBlocks([]);
			setError('');
			setRunState('idle');
			setRunLabel(settings.modelId ? 'Ready' : 'Setup needed');
			window.requestAnimationFrame(() =>
				document.querySelector<HTMLTextAreaElement>('#coding-composer')?.focus()
			);
			if (!preview) void app.setAppStoreValue(ACTIVE_PROJECT_KEY, projectId);
		},
		[activeProjectId, preview, settings.modelId]
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const command = event.metaKey || event.ctrlKey;
			if (command && event.key.toLowerCase() === 'n' && !runningRef.current) {
				event.preventDefault();
				newSession();
			}
			if (command && event.key === '/') {
				event.preventDefault();
				document.querySelector<HTMLTextAreaElement>('#coding-composer')?.focus();
			}
			if (event.key === 'Escape' && query) setQuery('');
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [newSession, query]);

	const selectProject = useCallback(
		async (projectId: string): Promise<void> => {
			if (runningRef.current || projectId === activeProjectId) return;
			await loadProject(projectId);
			if (!preview) await app.setAppStoreValue(ACTIVE_PROJECT_KEY, projectId);
			setExpandedProjectIds((current) =>
				current.includes(projectId) ? current : [...current, projectId]
			);
		},
		[activeProjectId, loadProject, preview]
	);

	const selectSession = useCallback(
		async (projectId: string, sessionId: string): Promise<void> => {
			if (runningRef.current || (projectId === activeProjectId && sessionId === activeSessionId))
				return;
			setBusy(true);
			setError('');
			try {
				if (preview) {
					setActiveProjectId(projectId);
					setActiveSessionId(sessionId);
					setBlocks(previewBlocks);
				} else {
					const snapshot = await codingApi.getSession(projectId, sessionId);
					setActiveProjectId(projectId);
					setActiveSessionId(sessionId);
					setBlocks(
						snapshot.blocks.map(
							(block: CodingSessionBlock): CodingBlock =>
								block.type === 'message' ? { ...block, status: 'complete' } : block
						)
					);
					await app.setAppStoreValue(ACTIVE_PROJECT_KEY, projectId);
				}
				setExpandedProjectIds((current) =>
					current.includes(projectId) ? current : [...current, projectId]
				);
			} catch (reason) {
				setError(reason instanceof Error ? reason.message : 'Unable to open this session.');
			} finally {
				setBusy(false);
			}
		},
		[activeProjectId, activeSessionId, preview]
	);

	const addProject = useCallback(async (): Promise<void> => {
		if (runningRef.current || preview) return;
		setBusy(true);
		setError('');
		try {
			const project = await codingApi.addProject();
			if (!project) return;
			const nextProjects = await codingApi.listProjects();
			setProjects(nextProjects);
			setSessionsByProject((current) => ({ ...current, [project.id]: [] }));
			setExpandedProjectIds((current) => [...new Set([...current, project.id])]);
			await loadProject(project.id);
			await app.setAppStoreValue(ACTIVE_PROJECT_KEY, project.id);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to add this project.');
		} finally {
			setBusy(false);
		}
	}, [loadProject, preview]);

	const removeProject = useCallback(
		async (projectId: string): Promise<void> => {
			if (runningRef.current || preview) return;
			setBusy(true);
			setError('');
			try {
				await codingApi.removeProject(projectId);
				const nextProjects = await codingApi.listProjects();
				setProjects(nextProjects);
				setSessionsByProject((current) => {
					const next = { ...current };
					delete next[projectId];
					return next;
				});
				setExpandedProjectIds((current) => current.filter((id) => id !== projectId));
				if (projectId === activeProjectId) {
					const nextProject = nextProjects[0];
					if (nextProject) {
						await loadProject(nextProject.id);
						await app.setAppStoreValue(ACTIVE_PROJECT_KEY, nextProject.id);
					} else {
						setActiveProjectId(undefined);
						setActiveSessionId(undefined);
						setBlocks([]);
						await app.deleteAppStoreValue(ACTIVE_PROJECT_KEY);
					}
				}
			} catch (reason) {
				setError(reason instanceof Error ? reason.message : 'Unable to remove this project.');
			} finally {
				setBusy(false);
			}
		},
		[activeProjectId, loadProject, preview]
	);

	const openProject = useCallback(
		async (projectId: string): Promise<void> => {
			if (preview) return;
			setError('');
			try {
				await codingApi.openProject(projectId);
			} catch (reason) {
				setError(reason instanceof Error ? reason.message : 'Unable to open this project folder.');
			}
		},
		[preview]
	);

	const refresh = useCallback(async (): Promise<void> => {
		if (preview) return;
		setBusy(true);
		setError('');
		try {
			const [nextSettings, nextProjects] = await Promise.all([
				codingApi.getSettings(),
				codingApi.listProjects(),
			]);
			const groupedSessions = await Promise.all(
				nextProjects.map(
					async (project) => [project.id, await codingApi.listSessions(project.id)] as const
				)
			);
			setSettings(nextSettings);
			setProjects(nextProjects);
			setSessionsByProject(Object.fromEntries(groupedSessions));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to refresh Coder.');
		} finally {
			setBusy(false);
		}
	}, [preview]);

	const toggleProject = useCallback((projectId: string): void => {
		setExpandedProjectIds((current) =>
			current.includes(projectId)
				? current.filter((id) => id !== projectId)
				: [...current, projectId]
		);
	}, []);

	const cancelRun = useCallback(() => {
		if (!runningRef.current) return;
		cancelRequestedRef.current = true;
		setRunLabel('Stopping');
		const runId = activeRunIdRef.current;
		if (runId && !preview) void codingApi.cancel(runId).catch(() => undefined);
	}, [preview]);

	const send = useCallback(async (): Promise<void> => {
		const requestInput = input.trim();
		const project = projects.find((item) => item.id === activeProjectId);
		if (!requestInput || !project || !project.available || runningRef.current) return;
		if (!settings.modelId.trim()) {
			setError('Select and connect a model in Kucedr Settings → Coder before starting.');
			setRunState('error');
			setRunLabel('Setup needed');
			return;
		}
		if (preview) {
			setInput('');
			setBlocks((current) => [
				...current,
				{
					id: crypto.randomUUID(),
					type: mode === 'shell' ? 'command' : 'message',
					...(mode === 'shell'
						? {
								command: requestInput,
								output: 'Preview only',
								status: 'succeeded' as const,
								truncated: false,
							}
						: { role: 'user' as const, content: requestInput, status: 'complete' as const }),
					timestamp: new Date().toISOString(),
				} as CodingBlock,
			]);
			return;
		}

		const commandBlockId = crypto.randomUUID();
		runningRef.current = true;
		cancelRequestedRef.current = false;
		activeRunIdRef.current = '';
		setInput('');
		setError('');
		setRunState('running');
		setRunLabel(mode === 'shell' ? 'Starting command' : 'Starting agent');
		setBlocks((current) => [
			...current,
			mode === 'shell'
				? {
						id: commandBlockId,
						type: 'command',
						command: requestInput,
						output: '',
						status: 'running',
						truncated: false,
						timestamp: new Date().toISOString(),
					}
				: {
						id: crypto.randomUUID(),
						type: 'message',
						role: 'user',
						content: requestInput,
						status: 'complete',
						timestamp: new Date().toISOString(),
					},
		]);

		const onEvent = (event: CodingResponseEvent): void => {
			if (event.type === 'status') {
				if (event.status === 'started') {
					activeRunIdRef.current = event.runId;
					setActiveSessionId(event.sessionId);
					setRunLabel(mode === 'shell' ? 'Running command' : 'Agent running');
					if (cancelRequestedRef.current) void codingApi.cancel(event.runId).catch(() => undefined);
				} else if (event.status === 'cancelled') {
					setRunLabel('Cancelled');
					setBlocks((current) =>
						current.map((block) =>
							block.type === 'command' && block.id === commandBlockId
								? { ...block, status: 'cancelled' }
								: block.type === 'message' && block.status === 'streaming'
									? { ...block, status: 'complete' }
									: block
						)
					);
				} else {
					setRunLabel('Complete');
					setBlocks((current) =>
						current.map((block) =>
							block.type === 'message' && block.status === 'streaming'
								? { ...block, status: 'complete' }
								: block
						)
					);
				}
				return;
			}
			if (event.type === 'text-delta') {
				setRunLabel('Responding');
				setBlocks((current) => {
					const last = current.at(-1);
					if (
						last?.type === 'message' &&
						last.role === 'assistant' &&
						last.status === 'streaming'
					) {
						return current.map((block) =>
							block.id === last.id ? { ...last, content: last.content + event.delta } : block
						);
					}
					return [
						...current,
						{
							id: crypto.randomUUID(),
							type: 'message',
							role: 'assistant',
							content: event.delta,
							status: 'streaming',
							timestamp: new Date().toISOString(),
						},
					];
				});
				return;
			}
			if (event.type === 'thinking-delta') {
				setRunLabel('Thinking');
				return;
			}
			if (event.type === 'tool-start') {
				setRunLabel(`Using ${event.toolName}`);
				setBlocks((current) => [
					...current,
					{
						id: event.toolCallId,
						type: 'tool',
						toolName: event.toolName,
						status: 'running',
						timestamp: new Date().toISOString(),
					},
				]);
				return;
			}
			if (event.type === 'tool-end') {
				setBlocks((current) =>
					current.map((block) =>
						block.type === 'tool' && block.id === event.toolCallId
							? { ...block, status: event.isError ? 'failed' : 'succeeded' }
							: block
					)
				);
				return;
			}
			if (event.type === 'command-output') {
				setBlocks((current) =>
					current.map((block) =>
						block.type === 'command' && block.id === commandBlockId
							? { ...block, output: block.output + event.delta }
							: block
					)
				);
				return;
			}
			if (event.type === 'command-end') {
				setBlocks((current) =>
					current.map((block) =>
						block.type === 'command' && block.id === commandBlockId
							? {
									...block,
									status: event.cancelled
										? 'cancelled'
										: event.exitCode === 0
											? 'succeeded'
											: 'failed',
									...(event.exitCode === undefined ? {} : { exitCode: event.exitCode }),
									truncated: event.truncated,
								}
							: block
					)
				);
				return;
			}
			if (event.type === 'error') {
				setError(event.message);
				setRunState('error');
				setRunLabel('Failed');
			}
		};

		try {
			const result = await codingApi.send(
				{
					projectId: project.id,
					...(activeSessionId ? { sessionId: activeSessionId } : {}),
					mode,
					input: requestInput,
				},
				onEvent
			);
			setActiveSessionId(result.sessionId);
			setRunState('idle');
			setRunLabel('Ready');
			const [nextProjects, nextSessions] = await Promise.all([
				codingApi.listProjects(),
				codingApi.listSessions(project.id),
			]);
			setProjects(nextProjects);
			setSessionsByProject((current) => ({ ...current, [project.id]: nextSessions }));
		} catch (reason) {
			const message =
				reason instanceof Error ? reason.message : 'Coder could not finish this task.';
			const cancelled = cancelRequestedRef.current || message === 'Coder run cancelled.';
			setRunState(cancelled ? 'idle' : 'error');
			setRunLabel(cancelled ? 'Cancelled' : 'Failed');
			if (!cancelled) setError(message);
		} finally {
			activeRunIdRef.current = '';
			cancelRequestedRef.current = false;
			runningRef.current = false;
		}
	}, [activeProjectId, activeSessionId, input, mode, preview, projects, settings.modelId]);

	return {
		activeProject: projects.find((project) => project.id === activeProjectId),
		activeProjectId,
		activeSessionId,
		blocks,
		busy,
		error,
		input,
		isPreview: preview,
		leftOpen,
		loading: runState === 'loading',
		mode,
		modelId: settings.modelId,
		projects,
		providerId: settings.providerId,
		query,
		runLabel,
		runState,
		sessions,
		sessionsByProject,
		expandedProjectIds,
		thinkingLevel: settings.thinkingLevel,
		toolMode: settings.toolMode,
		addProject,
		cancelRun,
		newSession,
		openProject,
		refresh,
		removeProject,
		selectProject,
		selectSession,
		send,
		setInput,
		setLeftOpen,
		setMode,
		setQuery,
		toggleProject,
	};
}
