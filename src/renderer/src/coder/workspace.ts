import { useCallback, useEffect, useRef, useState } from 'react';
import type {
	CodingProject,
	CodingResponseEvent,
	CodingRunMode,
	CodingSessionSnapshot,
	CodingSessionSummary,
	CodingSettings,
} from '@shared/coding_types';
import type { CoderBlock } from './types';
import { applyEvent } from './events';

export function useWorkspace() {
	const [projects, setProjects] = useState<CodingProject[]>([]);
	const [projectId, setProjectId] = useState('');
	const [sessionsByProject, setSessions] = useState<Record<string, CodingSessionSummary[]>>({});
	const [snapshot, setSnapshot] = useState<CodingSessionSnapshot | null>(null);
	const [blocks, setBlocks] = useState<CoderBlock[]>([]);
	const [settings, setSettings] = useState<CodingSettings | null>(null);
	const [input, setInput] = useState('');
	const [mode, setMode] = useState<CodingRunMode>('agent');
	const [status, setStatus] = useState('');
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [revision, setRevision] = useState(0);
	const [interactions, setInteractions] = useState<
		Extract<CodingResponseEvent, { type: 'interaction' }>[]
	>([]);
	const selection = useRef(0);
	const selectedHarness = useRef<CodingSettings['runtime'] | undefined>(undefined);
	useEffect(() => {
		selectedHarness.current = settings?.runtime;
	}, [settings?.runtime]);
	const running = useRef(false);
	const runId = useRef('');
	const cancelRequested = useRef(false);

	const select = useCallback(async (nextProjectId: string, sessionId?: string, fresh = false) => {
		if (running.current) return;
		const request = ++selection.current;
		setProjectId(nextProjectId);
		setSnapshot(null);
		setBlocks([]);
		setInput('');
		setError('');
		setLoading(true);
		try {
			const items = await window.coder.listSessions(nextProjectId);
			if (request !== selection.current) return;
			setSessions((current) => ({ ...current, [nextProjectId]: items }));
			const id = fresh ? undefined : (sessionId ?? items[0]?.id);
			if (id) {
				const next = await window.coder.getSession(nextProjectId, id);
				if (request !== selection.current) return;
				setSnapshot(next);
				setBlocks([...next.blocks]);
				const savedSettings =
					next.session.settings ?? (await window.coder.getSettings(next.session.runtime ?? 'pi'));
				if (request === selection.current) setSettings(savedSettings);
			} else {
				const defaults = await window.coder.getSettings(selectedHarness.current);
				if (request === selection.current) setSettings(defaults);
			}
		} catch (cause) {
			if (request === selection.current) setError(String(cause));
		} finally {
			if (request === selection.current) setLoading(false);
		}
	}, []);

	useEffect(() => {
		let active = true;
		const requests = selection;
		void Promise.all([window.coder.listProjects(), window.coder.getSettings()])
			.then(async ([items, nextSettings]) => {
				const grouped = await Promise.all(
					items.map(
						async (item) =>
							[item.id, item.available ? await window.coder.listSessions(item.id) : []] as const
					)
				);
				if (!active) return;
				setProjects(items);
				setSettings(nextSettings);
				setSessions(Object.fromEntries(grouped));
				const first = items.find((item) => item.available);
				if (first) await select(first.id);
			})
			.catch((cause: Error) => active && setError(cause.message))
			.finally(() => active && setLoading(false));
		return () => {
			active = false;
			requests.current++;
		};
	}, [select]);

	const refreshSettings = async (runtime?: CodingSettings['runtime']) => {
		try {
			if (snapshot) {
				const next = await window.coder.getSession(projectId, snapshot.session.id);
				setSnapshot(next);
				setSettings(
					next.session.settings ?? (await window.coder.getSettings(next.session.runtime ?? 'pi'))
				);
			} else setSettings(await window.coder.getSettings(runtime ?? settings?.runtime));
		} catch (cause) {
			setError(String(cause));
		}
	};
	const addProject = async () => {
		if (running.current || loading) return;
		setLoading(true);
		setError('');
		try {
			const project = await window.coder.addProject();
			if (!project) return;
			setProjects(await window.coder.listProjects());
			await select(project.id, undefined, true);
		} catch (cause) {
			setError(String(cause));
		} finally {
			setLoading(false);
		}
	};
	const removeProject = async (id: string) => {
		if (running.current || loading) return;
		setLoading(true);
		setError('');
		try {
			await window.coder.removeProject(id);
			const items = await window.coder.listProjects();
			setProjects(items);
			if (projectId === id) {
				selection.current++;
				setProjectId('');
				setSnapshot(null);
				setBlocks([]);
				setInput('');
				const first = items.find((item) => item.available);
				if (first) await select(first.id);
			}
		} catch (cause) {
			setError(String(cause));
		} finally {
			setLoading(false);
		}
	};
	const openProject = async (id: string) => {
		try {
			await window.coder.openProject(id);
		} catch (cause) {
			setError(String(cause));
		}
	};
	const cancel = async () => {
		if (!running.current) return;
		cancelRequested.current = true;
		setStatus('Stopping…');
		if (!runId.current) return;
		try {
			await window.coder.cancel(runId.current);
		} catch (cause) {
			setError(String(cause));
		}
	};
	const changeHarness = async (runtime: CodingSettings['runtime']) => {
		if (running.current || snapshot) return;
		setLoading(true);
		try {
			setSettings(await window.coder.getSettings(runtime));
		} catch (cause) {
			setError(String(cause));
		} finally {
			setLoading(false);
		}
	};
	const respond = async (
		requestId: string,
		approved: boolean,
		answers?: Record<string, string>
	) => {
		try {
			if (
				await window.coder.respond(runId.current, requestId, {
					approved,
					answers,
				})
			)
				setInteractions((current) => current.filter((item) => item.requestId !== requestId));
		} catch (cause) {
			setError(String(cause));
		}
	};
	const send = async () => {
		const project = projects.find((item) => item.id === projectId);
		if (
			running.current ||
			loading ||
			(!project?.available && !settings?.workingDirectory) ||
			!input.trim()
		)
			return;
		if (mode === 'agent' && !settings?.modelId) {
			setError('Choose a model in Coder configuration.');
			return;
		}
		const prompt = input.trim();
		const commandId = crypto.randomUUID();
		running.current = true;
		cancelRequested.current = false;
		runId.current = '';
		setBusy(true);
		setInput('');
		setError('');
		setStatus(mode === 'shell' ? 'Running command…' : 'Working…');
		setBlocks((current) => [
			...current,
			mode === 'shell'
				? {
						id: commandId,
						type: 'command',
						command: prompt,
						output: '',
						status: 'running',
						truncated: false,
						timestamp: new Date().toISOString(),
					}
				: {
						id: crypto.randomUUID(),
						type: 'message',
						role: 'user',
						content: prompt,
						timestamp: new Date().toISOString(),
					},
		]);
		let sessionId = snapshot?.session.id;
		let activeProjectId = projectId;
		let failed = false;
		try {
			const handle = window.coder.start(
				{
					projectId,
					sessionId,
					mode,
					input: prompt,
					settings: settings ?? undefined,
					workingDirectory:
						snapshot?.session.workingDirectory ?? project?.directory ?? settings?.workingDirectory,
				},
				(event) => {
					sessionId = event.sessionId;
					activeProjectId = event.projectId;
					if (event.type === 'interaction') {
						setInteractions((current) => [
							...current.filter((item) => item.requestId !== event.requestId),
							event,
						]);
						setStatus('Waiting for your response…');
					}
					if (event.type === 'interaction-resolved')
						setInteractions((current) =>
							current.filter((item) => item.requestId !== event.requestId)
						);
					if (event.type === 'status' && event.status === 'started') {
						runId.current = event.runId;
						if (cancelRequested.current) void cancel();
					}
					setBlocks((current) => applyEvent(current, event, commandId));
					if (!cancelRequested.current) {
						if (event.type === 'thinking-delta') setStatus('Thinking…');
						if (event.type === 'text-delta') setStatus('Responding…');
						if (event.type === 'tool-start') setStatus(`Using ${event.toolName}…`);
					}
					if (event.type === 'error') {
						failed = true;
						setError(event.message);
					}
				}
			);
			runId.current = handle.runId;
			if (cancelRequested.current) void cancel();
			const result = await handle.result;
			sessionId = result.sessionId;
			activeProjectId = result.projectId;
		} catch (cause) {
			failed = !cancelRequested.current;
			if (failed) {
				setError(String(cause));
				setInput(prompt);
			}
		} finally {
			setBlocks((current) =>
				current.map((block) => {
					if (block.type === 'tool' && block.status === 'running')
						return { ...block, status: 'failed' };
					if (block.type === 'command' && block.status === 'running')
						return {
							...block,
							status: cancelRequested.current ? 'cancelled' : 'failed',
						};
					return block;
				})
			);
			try {
				if (sessionId) {
					const saved = await window.coder.getSession(activeProjectId, sessionId);
					setSnapshot(saved);
					setBlocks([...saved.blocks]);
					if (saved.session.settings) setSettings(saved.session.settings);
				}
				const sessions = await window.coder.listSessions(activeProjectId);
				setProjectId(activeProjectId);
				setProjects(await window.coder.listProjects());
				setSessions((current) => ({ ...current, [activeProjectId]: sessions }));
			} catch (cause) {
				setError(String(cause));
			}
			setInteractions([]);
			setStatus(cancelRequested.current ? 'Cancelled' : failed ? 'Failed' : 'Ready');
			runId.current = '';
			running.current = false;
			setBusy(false);
			setRevision((value) => value + 1);
		}
	};
	return {
		interactions,
		respond,
		changeHarness,
		projects,
		projectId,
		sessionsByProject,
		snapshot,
		blocks,
		settings,
		input,
		setInput,
		mode,
		setMode,
		status,
		busy,
		loading,
		error,
		revision,
		select,
		addProject,
		removeProject,
		openProject,
		refreshSettings,
		send,
		cancel,
	};
}

export type Workspace = ReturnType<typeof useWorkspace>;
