import { act, renderHook, waitFor } from '@testing-library/react';
import { useWorkspace } from '../../../src/renderer/src/coder/workspace';
import type {
	CodingResponseEvent,
	CodingRunResult,
	CodingSessionSnapshot,
} from '../../../src/shared/coding_types';

const project = {
	id: 'project-1',
	name: 'Coder',
	directory: '/project',
	kind: 'external',
	createdAt: '',
	lastOpenedAt: '',
	available: true,
};
const session = {
	id: 'session-1',
	projectId: project.id,
	title: 'Session',
	createdAt: '',
	updatedAt: '',
	messageCount: 1,
};
const api = {
	listProjects: jest.fn(),
	getSettings: jest.fn(),
	listSessions: jest.fn(),
	getSession: jest.fn(),
	start: jest.fn(),
	cancel: jest.fn(),
};
const eventContext = { projectId: project.id, sessionId: session.id, runId: 'run-1' };

beforeEach(() => {
	jest.resetAllMocks();
	Object.defineProperty(window, 'coder', { configurable: true, value: api });
	api.listProjects.mockResolvedValue([project, { ...project, id: 'project-2' }]);
	api.getSettings.mockResolvedValue({
		runtime: 'pi',
		providerId: 'openai-codex',
		modelId: 'model',
		thinkingLevel: 'high',
		toolMode: 'coding',
	});
	api.listSessions.mockResolvedValue([]);
	api.getSession.mockResolvedValue({ session, blocks: [] });
	api.cancel.mockResolvedValue(true);
});

it('keeps the latest selection when an earlier session read finishes later', async () => {
	const { result } = renderHook(() => useWorkspace());
	await waitFor(() => expect(result.current.loading).toBe(false));
	let resolveEarlier!: (snapshot: CodingSessionSnapshot) => void;
	api.getSession.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				resolveEarlier = resolve;
			})
	);
	let earlier!: Promise<void>;
	act(() => {
		earlier = result.current.select(project.id, session.id);
	});
	await waitFor(() => expect(api.getSession).toHaveBeenCalledWith(project.id, session.id));
	const latest = { session: { ...session, id: 'session-2', projectId: 'project-2' }, blocks: [] };
	api.getSession.mockResolvedValueOnce(latest);
	await act(async () => {
		await result.current.select('project-2', 'session-2');
	});
	await act(async () => {
		resolveEarlier({ session, blocks: [] });
		await earlier;
	});
	expect(result.current.projectId).toBe('project-2');
	expect(result.current.snapshot).toEqual(latest);
	expect(result.current.loading).toBe(false);
});

it('cancels a pending start and refreshes persisted sessions after cancellation', async () => {
	let emit!: (event: CodingResponseEvent) => void;
	let rejectRun!: (reason: Error) => void;
	api.start.mockImplementation((_request, onEvent) => {
		emit = onEvent;
		return {
			runId: 'run-1',
			result: new Promise((_resolve, reject) => {
				rejectRun = reject;
			}),
		};
	});
	const { result } = renderHook(() => useWorkspace());
	await waitFor(() => expect(result.current.loading).toBe(false));
	act(() => result.current.setInput('Write a test'));
	let sending!: Promise<void>;
	act(() => {
		sending = result.current.send();
	});
	await act(async () => {
		await result.current.cancel();
	});
	expect(api.cancel).toHaveBeenCalledWith('run-1');
	await act(async () => {
		emit({ ...eventContext, type: 'status', status: 'started' });
	});
	expect(api.cancel).toHaveBeenCalledWith('run-1');
	api.listSessions.mockClear();
	api.listSessions.mockResolvedValue([session]);
	await act(async () => {
		rejectRun(new Error('Coding run cancelled.'));
		await sending;
	});
	expect(api.getSession).toHaveBeenCalledWith(project.id, session.id);
	expect(api.listSessions).toHaveBeenCalledWith(project.id);
	expect(result.current.sessionsByProject[project.id]).toEqual([session]);
	expect(result.current.status).toBe('Cancelled');
	expect(result.current.error).toBe('');
	expect(result.current.busy).toBe(false);
});

it('streams shell output and exit details while blocking duplicate sends', async () => {
	let emit!: (event: CodingResponseEvent) => void;
	let resolveRun!: (result: CodingRunResult) => void;
	api.start.mockImplementation((_request, onEvent) => {
		emit = onEvent;
		return {
			runId: 'run-1',
			result: new Promise((resolve) => {
				resolveRun = resolve;
			}),
		};
	});
	const { result } = renderHook(() => useWorkspace());
	await waitFor(() => expect(result.current.loading).toBe(false));
	act(() => {
		result.current.setInput('  npm test  ');
		result.current.setMode('shell');
	});
	let sending!: Promise<void>;
	await act(async () => {
		sending = result.current.send();
		await result.current.send();
	});
	expect(api.start).toHaveBeenCalledTimes(1);
	expect(api.start).toHaveBeenCalledWith(
		expect.objectContaining({
			projectId: project.id,
			sessionId: undefined,
			mode: 'shell',
			input: 'npm test',
			workingDirectory: project.directory,
		}),
		expect.any(Function)
	);
	act(() => {
		emit({ ...eventContext, type: 'status', status: 'started' });
		emit({ ...eventContext, type: 'command-output', delta: 'first\n' });
		emit({ ...eventContext, type: 'command-output', delta: 'failure\n' });
		emit({ ...eventContext, type: 'command-end', exitCode: 1, cancelled: false, truncated: true });
	});
	expect(result.current.blocks).toEqual([
		expect.objectContaining({
			type: 'command',
			command: 'npm test',
			output: 'first\nfailure\n',
			status: 'failed',
			exitCode: 1,
			truncated: true,
		}),
	]);
	await act(async () => {
		resolveRun({ projectId: project.id, sessionId: session.id, output: 'first\nfailure\n' });
		await sending;
	});
	expect(result.current.busy).toBe(false);
});
