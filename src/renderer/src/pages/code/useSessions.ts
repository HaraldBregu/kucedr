import { useEffect, useRef, useState } from 'react';
import type { CoderInteractionResponse, CodingResponseEvent, CodingSessionSnapshot, CodingSessionSummary } from '@shared/coding_types';

export function useSessions(projectId: string) {
	const [sessions, setSessions] = useState<CodingSessionSummary[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
	const [snapshot, setSnapshot] = useState<CodingSessionSnapshot | null>(null);
	const [loading, setLoading] = useState(true);
	const [running, setRunning] = useState(false);
	const [output, setOutput] = useState('');
	const [error, setError] = useState('');
	const [interactions, setInteractions] = useState<Extract<CodingResponseEvent, { type: 'interaction' }>[]>([]);
	const generation = useRef(0);
	const selection = useRef(0);
	const activeRun = useRef<{ runId?: string; cancelled: boolean } | null>(null);

	useEffect(() => {
		const current = ++generation.current;
		selection.current += 1;
		setSessions([]);
		setSelectedSessionId(null);
		setSnapshot(null);
		setOutput('');
		setError('');
		setInteractions([]);
		setRunning(false);
		setLoading(true);
		void window.coder.listSessions(projectId).then((items) => {
			if (generation.current === current) setSessions(items);
		}).catch((cause: unknown) => {
			if (generation.current === current) setError(cause instanceof Error ? cause.message : 'Unable to load sessions.');
		}).finally(() => {
			if (generation.current === current) setLoading(false);
		});
		return () => {
			generation.current += 1;
			const run = activeRun.current;
			if (run) {
				run.cancelled = true;
				if (run.runId) void window.coder.cancel(run.runId).catch(() => undefined);
				activeRun.current = null;
			}
		};
	}, [projectId]);

	const selectSession = async (id: string | null): Promise<void> => {
		if (activeRun.current) return;
		const current = generation.current;
		const request = ++selection.current;
		setSelectedSessionId(id);
		setSnapshot(null);
		setOutput('');
		setError('');
		setLoading(id !== null);
		if (!id) return;
		try {
			const value = await window.coder.getSession(projectId, id);
			if (generation.current === current && selection.current === request) setSnapshot(value);
		} catch (cause) {
			if (generation.current === current && selection.current === request) setError(cause instanceof Error ? cause.message : 'Unable to open session.');
		} finally {
			if (generation.current === current && selection.current === request) setLoading(false);
		}
	};

	const run = async (input: string, fileName: string, content: string): Promise<boolean> => {
		if (!input.trim() || activeRun.current || loading) return false;
		const current = generation.current;
		const pending: { runId?: string; cancelled: boolean } = { cancelled: false };
		activeRun.current = pending;
		setRunning(true);
		setError('');
		setOutput('');
		setInteractions([]);
		let sessionId = selectedSessionId;
		let succeeded = false;
		try {
			const result = await window.coder.send({
				projectId,
				...(sessionId ? { sessionId } : {}),
				mode: 'agent',
				input: `${input.trim()}\n\nSelected workspace file: ${fileName}\nCurrent editor content:\n${content}`,
			}, (event) => {
				pending.runId = event.runId;
				if (pending.cancelled) {
					void window.coder.cancel(event.runId).catch(() => undefined);
					return;
				}
				if (generation.current !== current) return;
				sessionId = event.sessionId;
				setSelectedSessionId(event.sessionId);
				if (event.type === 'text-delta' || event.type === 'command-output') setOutput((value) => value + event.delta);
				if (event.type === 'interaction') setInteractions((items) => [...items.filter((item) => item.requestId !== event.requestId), event]);
				if (event.type === 'interaction-resolved') setInteractions((items) => items.filter((item) => item.requestId !== event.requestId));
				if (event.type === 'error') setError(event.message);
			});
			sessionId = result.sessionId;
			succeeded = !pending.cancelled;
		} catch (cause) {
			if (generation.current === current) setError(cause instanceof Error ? cause.message : 'Unable to run session.');
		} finally {
			if (generation.current === current) {
				try {
					const [items, value] = await Promise.all([window.coder.listSessions(projectId), sessionId ? window.coder.getSession(projectId, sessionId) : Promise.resolve(null)]);
					if (generation.current === current) {
						setSessions(items);
						setSnapshot(value);
						if (value) setOutput('');
					}
				} catch (cause) {
					if (generation.current === current) setError(cause instanceof Error ? cause.message : 'Unable to refresh sessions.');
				} finally {
					if (generation.current === current) {
						activeRun.current = null;
						setRunning(false);
						setInteractions([]);
					}
				}
			}
		}
		return succeeded && generation.current === current;
	};

	const cancel = async (): Promise<void> => {
		const pending = activeRun.current;
		if (!pending) return;
		pending.cancelled = true;
		try {
			if (pending.runId) await window.coder.cancel(pending.runId);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Unable to stop session.');
		}
	};

	const respond = async (requestId: string, response: CoderInteractionResponse): Promise<void> => {
		const current = generation.current;
		const runId = activeRun.current?.runId;
		if (!runId) return;
		try {
			await window.coder.respond(runId, requestId, response);
			if (generation.current === current) setInteractions((items) => items.filter((item) => item.requestId !== requestId));
		} catch (cause) {
			if (generation.current === current) setError(cause instanceof Error ? cause.message : 'Unable to respond to session.');
		}
	};

	return { sessions, selectedSessionId, snapshot, loading, running, output, error, interactions, selectSession, run, cancel, respond };
}
