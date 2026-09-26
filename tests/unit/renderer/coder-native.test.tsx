import { act, renderHook, waitFor } from '@testing-library/react';
import { useWorkspace } from '../../../src/renderer/src/coder/workspace';
import type { CodingSettings } from '../../../src/shared/coding_types';

const defaults: CodingSettings = {
	runtime: 'pi',
	providerId: 'openai-codex',
	modelId: 'default-model',
	thinkingLevel: 'medium',
	toolMode: 'read-only',
};
const saved: CodingSettings = {
	...defaults,
	runtime: 'claude',
	providerId: 'anthropic',
	modelId: 'saved-model',
};
const project = { id: 'p', name: 'Project', directory: '/workspace/project', available: true };
const session = {
	id: 's',
	projectId: 'p',
	runtime: 'claude',
	settings: saved,
	workingDirectory: '/workspace/project',
};
let api: Record<string, jest.Mock>;
beforeEach(() => {
	api = {
		getSettings: jest
			.fn()
			.mockImplementation(async (runtime) => ({ ...defaults, runtime: runtime ?? 'pi' })),
		listProjects: jest.fn().mockResolvedValue([project]),
		listSessions: jest.fn().mockResolvedValue([session]),
		getSession: jest.fn().mockResolvedValue({ session, blocks: [] }),
		start: jest.fn(),
		cancel: jest.fn().mockResolvedValue(true),
		respond: jest.fn().mockResolvedValue(true),
	};
	Object.defineProperty(window, 'coder', { configurable: true, value: api });
});

test('restores the session harness and settings instead of mutable defaults', async () => {
	const { result } = renderHook(() => useWorkspace());
	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.settings).toEqual(saved);
	await act(async () => result.current.changeHarness('codex'));
	expect(result.current.settings).toEqual(saved);
});

test('new sessions can select another harness without changing the saved session', async () => {
	const { result } = renderHook(() => useWorkspace());
	await waitFor(() => expect(result.current.loading).toBe(false));
	await act(async () => result.current.select('p', undefined, true));
	await act(async () => result.current.changeHarness('codex'));
	expect(result.current.snapshot).toBeNull();
	expect(result.current.settings?.runtime).toBe('codex');
	expect(session.settings).toEqual(saved);
});

test('stop uses the immediate run handle before any runtime event arrives', async () => {
	let finish!: (value: { projectId: string; sessionId: string; output: string }) => void;
	api.start.mockReturnValue({
		runId: 'starting-run',
		result: new Promise((resolve) => {
			finish = resolve;
		}),
	});
	const { result } = renderHook(() => useWorkspace());
	await waitFor(() => expect(result.current.loading).toBe(false));
	act(() => result.current.setInput('Explain this project'));
	let sending!: Promise<void>;
	act(() => {
		sending = result.current.send();
	});
	await act(async () => result.current.cancel());
	expect(api.cancel).toHaveBeenCalledWith('starting-run');
	await act(async () => {
		finish({ projectId: 'p', sessionId: 's', output: '' });
		await sending;
	});
});

test('approval replies retain the active run and request IDs', async () => {
	let finish!: (value: { projectId: string; sessionId: string; output: string }) => void;
	let emit!: (event: unknown) => void;
	api.start.mockImplementation((_request, callback) => {
		emit = callback;
		return {
			runId: 'approval-run',
			result: new Promise((resolve) => {
				finish = resolve;
			}),
		};
	});
	const { result } = renderHook(() => useWorkspace());
	await waitFor(() => expect(result.current.loading).toBe(false));
	act(() => result.current.setInput('Update file'));
	let sending!: Promise<void>;
	act(() => {
		sending = result.current.send();
	});
	act(() =>
		emit({
			type: 'interaction',
			runId: 'approval-run',
			sessionId: 's',
			projectId: 'p',
			requestId: 'request-1',
			toolName: 'Edit',
			input: { path: 'index.ts' },
		})
	);
	expect(result.current.interactions).toHaveLength(1);
	await act(async () => result.current.respond('request-1', false));
	expect(api.respond).toHaveBeenCalledWith('approval-run', 'request-1', {
		approved: false,
		answers: undefined,
	});
	expect(result.current.interactions).toHaveLength(0);
	await act(async () => {
		finish({ projectId: 'p', sessionId: 's', output: '' });
		await sending;
	});
});
