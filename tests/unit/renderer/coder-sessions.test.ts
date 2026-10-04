import { act, renderHook, waitFor } from '@testing-library/react';
import type { CodingResponseEvent, CodingRunResult, CodingSessionSnapshot } from '../../../src/shared/coding_types';
import { useSessions } from '../../../src/renderer/src/pages/code/useSessions';

const session = { id: 'session-1', projectId: 'workspace-1', title: 'Fix layout', createdAt: '', updatedAt: '', messageCount: 1, runtime: 'codex' as const };
const snapshot: CodingSessionSnapshot = { session, blocks: [] };
const api = { listSessions: jest.fn(), getSession: jest.fn(), send: jest.fn(), cancel: jest.fn(), respond: jest.fn() };

beforeEach(() => {
	Object.defineProperty(window, 'coder', { configurable: true, value: api });
	api.listSessions.mockResolvedValue([session]);
	api.getSession.mockResolvedValue(snapshot);
	api.cancel.mockResolvedValue(true);
	api.respond.mockResolvedValue(true);
});

it('runs with editor context, reuses the selected harness session, and refreshes its transcript', async () => {
	api.send.mockImplementation(async (_request, emit: (event: CodingResponseEvent) => void) => {
		emit({ type: 'status', status: 'started', runId: 'run-1', projectId: session.projectId, sessionId: session.id });
		emit({ type: 'text-delta', delta: 'Done', runId: 'run-1', projectId: session.projectId, sessionId: session.id });
		return { projectId: session.projectId, sessionId: session.id, output: 'Done' };
	});
	const { result } = renderHook(() => useSessions(session.projectId));
	await waitFor(() => expect(result.current.loading).toBe(false));
	await act(() => result.current.selectSession(session.id));
	let success = false;
	await act(async () => { success = await result.current.run('Fix the heading', 'README.md', '# Unsaved heading'); });
	expect(success).toBe(true);
	expect(api.send).toHaveBeenCalledWith({ projectId: session.projectId, sessionId: session.id, mode: 'agent', input: 'Fix the heading\n\nSelected workspace file: README.md\nCurrent editor content:\n# Unsaved heading' }, expect.any(Function));
	expect(result.current.snapshot).toEqual(snapshot);
	expect(result.current.running).toBe(false);
	expect(result.current.output).toBe('');
	expect(api.listSessions).toHaveBeenCalledTimes(2);
	expect(api.getSession).toHaveBeenCalledTimes(2);
});

it('ignores a stale session load after selecting another session', async () => {
	let resolveFirst!: (value: CodingSessionSnapshot) => void;
	api.getSession.mockImplementationOnce(() => new Promise<CodingSessionSnapshot>((resolve) => { resolveFirst = resolve; }));
	const latest = { session: { ...session, id: 'session-2' }, blocks: [] };
	api.getSession.mockResolvedValueOnce(latest);
	const { result } = renderHook(() => useSessions(session.projectId));
	await waitFor(() => expect(result.current.loading).toBe(false));
	let first!: Promise<void>;
	act(() => { first = result.current.selectSession(session.id); });
	await act(() => result.current.selectSession('session-2'));
	await act(async () => { resolveFirst(snapshot); await first; });
	expect(result.current.selectedSessionId).toBe('session-2');
	expect(result.current.snapshot).toEqual(latest);
	expect(result.current.loading).toBe(false);
});

it('responds to harness questions and cancels an active run without switching sessions', async () => {
	let emit!: (event: CodingResponseEvent) => void;
	let finish!: (value: CodingRunResult) => void;
	api.send.mockImplementation((_request, onEvent) => {
		emit = onEvent;
		return new Promise<CodingRunResult>((resolve) => { finish = resolve; });
	});
	const { result } = renderHook(() => useSessions(session.projectId));
	await waitFor(() => expect(result.current.loading).toBe(false));
	let run!: Promise<boolean>;
	act(() => { run = result.current.run('Update file', 'README.md', 'Original'); });
	act(() => emit({ type: 'interaction', runId: 'run-1', projectId: session.projectId, sessionId: session.id, requestId: 'question-1', toolName: 'ask_user', input: {}, kind: 'input', questions: [{ id: 'target', question: 'Which heading?' }] }));
	expect(result.current.interactions).toHaveLength(1);
	await act(() => result.current.respond('question-1', { approved: true, answers: { target: 'Introduction' } }));
	expect(api.respond).toHaveBeenCalledWith('run-1', 'question-1', { approved: true, answers: { target: 'Introduction' } });
	expect(result.current.interactions).toEqual([]);
	await act(() => result.current.selectSession('different-session'));
	expect(result.current.selectedSessionId).toBe(session.id);
	await act(() => result.current.cancel());
	expect(api.cancel).toHaveBeenCalledWith('run-1');
	let success = true;
	await act(async () => { finish({ projectId: session.projectId, sessionId: session.id, output: '' }); success = await run; });
	expect(success).toBe(false);
	expect(result.current.running).toBe(false);
});

it('cancels a run requested before its first event when the workspace unmounts', async () => {
	let emit!: (event: CodingResponseEvent) => void;
	let finish!: (value: CodingRunResult) => void;
	api.send.mockImplementation((_request, onEvent) => {
		emit = onEvent;
		return new Promise<CodingRunResult>((resolve) => { finish = resolve; });
	});
	const { result, unmount } = renderHook(() => useSessions(session.projectId));
	await waitFor(() => expect(result.current.loading).toBe(false));
	let run!: Promise<boolean>;
	act(() => { run = result.current.run('Update file', 'README.md', 'Original'); });
	unmount();
	emit({ type: 'status', status: 'started', runId: 'run-1', projectId: session.projectId, sessionId: session.id });
	expect(api.cancel).toHaveBeenCalledWith('run-1');
	finish({ projectId: session.projectId, sessionId: session.id, output: '' });
	expect(await run).toBe(false);
	expect(api.listSessions).toHaveBeenCalledTimes(1);
});
