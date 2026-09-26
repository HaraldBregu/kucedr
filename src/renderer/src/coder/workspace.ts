import { useCallback, useEffect, useRef, useState } from 'react';
import type {
	CodingProject,
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
	const selection = useRef(0);
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
			const items = await window.coding.listSessions(nextProjectId);
			if (request !== selection.current) return;
			setSessions((current) => ({ ...current, [nextProjectId]: items }));
			const id = fresh ? undefined : (sessionId ?? items[0]?.id);
			if (id) {
				const next = await window.coding.getSession(nextProjectId, id);
				if (request !== selection.current) return;
				setSnapshot(next);
				setBlocks([...next.blocks]);
			}
		} catch (cause) {
			if (request === selection.current) setError(String(cause));
		} finally {
			if (request === selection.current) setLoading(false);
		}
	}, []);

	useEffect(() => {
		let active = true;
		void Promise.all([window.coding.listProjects(), window.coding.getSettings()])
			.then(async ([items, nextSettings]) => {
				const grouped = await Promise.all(
					items.map(
						async (item) =>
							[item.id, item.available ? await window.coding.listSessions(item.id) : []] as const
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
			selection.current++;
		};
	}, [select]);

	const refreshSettings = async () => {
		try {
			setSettings(await window.coding.getSettings());
		} catch (cause) {
			setError(String(cause));
		}
	};
	const addProject = async () => {
		if (running.current || loading) return;
		setLoading(true);
		setError('');
		try {
			const project = await window.coding.addProject();
			if (!project) return;
			setProjects(await window.coding.listProjects());
			await select(project.id);
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
			await window.coding.removeProject(id);
			const items = await window.coding.listProjects();
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
			await window.coding.openProject(id);
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
			await window.coding.cancel(runId.current);
		} catch (cause) {
			setError(String(cause));
		}
	};
	const send = async () => {
		const project = projects.find((item) => item.id === projectId);
		if (running.current || loading || !project?.available || !input.trim()) return;
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
		let failed = false;
		try {
			const result = await window.coding.send(
				{ projectId, sessionId, mode, input: prompt },
				(event) => {
					sessionId = event.sessionId;
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
			sessionId = result.sessionId;
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
				if (sessionId) setSnapshot(await window.coding.getSession(projectId, sessionId));
				const sessions = await window.coding.listSessions(projectId);
				setSessions((current) => ({ ...current, [projectId]: sessions }));
			} catch (cause) {
				setError(String(cause));
			}
			setStatus(cancelRequested.current ? 'Cancelled' : failed ? 'Failed' : 'Ready');
			runId.current = '';
			running.current = false;
			setBusy(false);
			setRevision((value) => value + 1);
		}
	};
	return {
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
