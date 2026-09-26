import { useEffect, useRef, useState } from 'react';
import type {
	CodingProject,
	CodingSessionSnapshot,
	CodingSessionSummary,
} from '@shared/coding_types';

export function useWorkspace() {
	const [projects, setProjects] = useState<CodingProject[]>([]);
	const [projectId, setProjectId] = useState('');
	const [sessions, setSessions] = useState<CodingSessionSummary[]>([]);
	const [snapshot, setSnapshot] = useState<CodingSessionSnapshot | null>(null);
	const [input, setInput] = useState('');
	const [pending, setPending] = useState('');
	const [output, setOutput] = useState('');
	const [status, setStatus] = useState('');
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [runId, setRunId] = useState('');
	const [revision, setRevision] = useState(0);
	const selection = useRef(0);

	useEffect(() => {
		let active = true;
		void window.coding
			.listProjects()
			.then((items) => {
				if (!active) return;
				setProjects(items);
				setProjectId(items.find((item) => item.available)?.id ?? '');
			})
			.catch((cause: Error) => active && setError(cause.message))
			.finally(() => active && setLoading(false));
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		let active = true;
		selection.current++;
		setSnapshot(null);
		setSessions([]);
		setInput('');
		if (!projectId) return;
		setLoading(true);
		setError('');
		void window.coding
			.listSessions(projectId)
			.then((items) => {
				if (active) setSessions(items);
			})
			.catch((cause: Error) => active && setError(cause.message))
			.finally(() => active && setLoading(false));
		return () => {
			active = false;
		};
	}, [projectId]);

	const selectSession = async (id?: string) => {
		const request = ++selection.current;
		setSnapshot(null);
		setInput('');
		setError('');
		if (!id) {
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const next = await window.coding.getSession(projectId, id);
			if (request === selection.current) setSnapshot(next);
		} catch (cause) {
			if (request === selection.current) setError(String(cause));
		} finally {
			if (request === selection.current) setLoading(false);
		}
	};

	const addProject = async () => {
		try {
			const project = await window.coding.addProject();
			if (!project) return;
			setProjects(await window.coding.listProjects());
			setProjectId(project.id);
		} catch (cause) {
			setError(String(cause));
		}
	};

	const send = async () => {
		if (busy || loading || !projectId || !input.trim()) return;
		const prompt = input.trim();
		setBusy(true);
		setPending(prompt);
		setInput('');
		setOutput('');
		setStatus('Working…');
		setError('');
		let sessionId = snapshot?.session.id;
		try {
			const result = await window.coding.send(
				{ projectId, sessionId, mode: 'agent', input: prompt },
				(event) => {
					sessionId = event.sessionId;
					setRunId(event.runId);
					if (event.type === 'text-delta') setOutput((text) => text + event.delta);
					if (event.type === 'tool-start') setStatus(`Running ${event.toolName}…`);
					if (event.type === 'tool-end') setStatus('Working…');
					if (event.type === 'error') setError(event.message);
				}
			);
			sessionId = result.sessionId;
		} catch (cause) {
			setError(String(cause));
			setInput(prompt);
		} finally {
			try {
				if (sessionId) setSnapshot(await window.coding.getSession(projectId, sessionId));
				setSessions(await window.coding.listSessions(projectId));
			} catch (cause) {
				setError(String(cause));
			}
			setPending('');
			setOutput('');
			setRunId('');
			setBusy(false);
			setRevision((value) => value + 1);
		}
	};

	const cancel = async () => {
		try {
			await window.coding.cancel(runId);
		} catch (cause) {
			setError(String(cause));
		}
	};

	return {
		projects,
		projectId,
		setProjectId,
		sessions,
		snapshot,
		input,
		setInput,
		pending,
		output,
		status,
		busy,
		loading,
		error,
		runId,
		revision,
		selectSession,
		addProject,
		send,
		cancel,
	};
}
