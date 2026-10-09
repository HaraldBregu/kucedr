import { act, renderHook } from '@testing-library/react';
import type { AgentResponseEvent } from '../../../src/shared/agent_types';
import { playSound } from '../../../src/renderer/src/lib/sounds/play';
import { useHomeAgent } from '../../../src/renderer/src/pages/home/hooks/useHomeAgent';

const mockDispatch = jest.fn();
const mockSetSessionId = jest.fn();
const send = jest.fn();
let mockSessionId = 'chat-one';
let onEvent: (event: AgentResponseEvent) => void;
let finish: (response: string) => void;
let runId: string;

jest.mock('../../../src/renderer/src/lib/sounds/play', () => ({ playSound: jest.fn() }));
jest.mock('../../../src/renderer/src/pages/home/context', () => ({
	useHomeAgentContext: () => ({ chatState: { messages: [] }, dispatchChat: mockDispatch }),
}));
jest.mock('../../../src/renderer/src/contexts/chat-session', () => ({
	useChatSession: () => ({ sessionId: mockSessionId, setSessionId: mockSetSessionId }),
}));

beforeEach(() => {
	mockSessionId = 'chat-one';
	jest.mocked(playSound).mockClear();
	mockDispatch.mockClear();
	mockSetSessionId.mockClear();
	send.mockReset();
	send.mockImplementation((_prompt, options, callback) => {
		runId = options.runId;
		onEvent = callback;
		return new Promise<string>((resolve) => { finish = resolve; });
	});
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: {
			send,
			cancel: jest.fn().mockResolvedValue(true),
			getSessionSnapshot: jest.fn().mockResolvedValue({ messages: [] }),
		},
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { getPathForFile: jest.fn().mockReturnValue('') },
	});
});

it('plays each chat cue once for a live successful run, without reacting to token or tool events', async () => {
	const { result } = renderHook(() => useHomeAgent({ setMode: jest.fn() }));
	act(() => result.current.setInput('Hello'));
	act(() => { void result.current.handleSubmit(); });
	expect(playSound).toHaveBeenCalledWith('send');
	const started: AgentResponseEvent = {
		type: 'run_started', agentId: 'main', runId, sessionId: 'chat-one', interactionMode: 'default',
	};
	act(() => {
		onEvent({ ...started, agentId: 'tasks' });
		onEvent({ ...started, runId: 'another-run' });
		onEvent(started);
		onEvent(started);
		onEvent({ type: 'run_state', agentId: 'main', runId, state: 'thinking' });
		onEvent({ type: 'text_delta', agentId: 'main', runId, delta: 'Hello' });
		onEvent({ type: 'text_delta', agentId: 'main', runId, delta: ' there' });
		onEvent({ type: 'run_finished', agentId: 'main', runId, stopReason: 'end_turn', outputChars: 11 });
		onEvent({ type: 'run_finished', agentId: 'main', runId, stopReason: 'end_turn', outputChars: 11 });
	});
	await act(async () => finish('Hello there'));
	expect(jest.mocked(playSound).mock.calls).toEqual([['send'], ['thinking'], ['response']]);
});

it('stays silent for empty submits and attachments that cannot be read', async () => {
	const { result } = renderHook(() => useHomeAgent({ setMode: jest.fn() }));
	await act(async () => { expect(await result.current.handleSubmit()).toBe(false); });
	const file = new File(['data'], 'notes.txt', { type: 'text/plain' });
	Object.defineProperty(file, 'arrayBuffer', { value: jest.fn().mockRejectedValue(new Error('Cannot read file')) });
	await act(async () => { expect(await result.current.handleSubmit([file])).toBe(false); });
	expect(playSound).not.toHaveBeenCalled();
	expect(send).not.toHaveBeenCalled();
});

it('plays the send cue for an attachment-only message after preparing its data', async () => {
	const { result } = renderHook(() => useHomeAgent({ setMode: jest.fn() }));
	const file = new File(['data'], 'notes.txt', { type: 'text/plain' });
	Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode('data').buffer });
	await act(async () => { void result.current.handleSubmit([file]); });
	expect(playSound).toHaveBeenCalledWith('send');
	expect(send).toHaveBeenCalled();
	await act(async () => finish('Done'));
});

it.each(['cancelled', 'error', 'timeout', 'max_tokens'] as const)('does not play a response cue for a %s result', async (stopReason) => {
	const { result } = renderHook(() => useHomeAgent({ setMode: jest.fn() }));
	act(() => result.current.setInput('Hello'));
	act(() => { void result.current.handleSubmit(); });
	act(() => onEvent({ type: 'run_finished', agentId: 'main', runId, stopReason, outputChars: 12 }));
	await act(async () => finish('Partial text'));
	expect(jest.mocked(playSound).mock.calls).toEqual([['send']]);
});

it('ignores late cues after Stop, even when a late event reports success', async () => {
	const { result } = renderHook(() => useHomeAgent({ setMode: jest.fn() }));
	act(() => result.current.setInput('Hello'));
	act(() => { void result.current.handleSubmit(); });
	await act(async () => { await result.current.handleSubmit(); });
	act(() => {
		onEvent({ type: 'run_started', agentId: 'main', runId, sessionId: 'chat-one', interactionMode: 'default' });
		onEvent({ type: 'run_finished', agentId: 'main', runId, stopReason: 'end_turn', outputChars: 10 });
	});
	await act(async () => finish('Late reply'));
	expect(jest.mocked(playSound).mock.calls).toEqual([['send']]);
});

it('does not play cues from history restoration or after navigating to another chat', async () => {
	window.agent.getSessionSnapshot = jest.fn().mockResolvedValue({
		messages: [],
		activeRun: {
			runId: 'restored-run', status: 'running', message: 'Earlier message',
			events: [{ type: 'run_started', agentId: 'main', runId: 'restored-run', sessionId: 'chat-one', interactionMode: 'default' }],
		},
	});
	const { result, rerender } = renderHook(() => useHomeAgent({ setMode: jest.fn() }));
	await act(async () => {});
	expect(playSound).not.toHaveBeenCalled();
	act(() => result.current.resetChat());
	act(() => result.current.setInput('Hello'));
	act(() => { void result.current.handleSubmit(); });
	mockSessionId = 'chat-two';
	rerender();
	act(() => {
		onEvent({ type: 'run_started', agentId: 'main', runId, sessionId: 'chat-one', interactionMode: 'default' });
		onEvent({ type: 'run_finished', agentId: 'main', runId, stopReason: 'end_turn', outputChars: 10 });
	});
	await act(async () => finish('Done'));
	expect(jest.mocked(playSound).mock.calls).toEqual([['send']]);
});

it('plays navigation feedback for the new-chat keyboard shortcut', async () => {
	renderHook(() => useHomeAgent({ setMode: jest.fn() }));
	await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true })); });
	expect(playSound).toHaveBeenCalledWith('navigate');
	expect(mockSetSessionId).toHaveBeenCalled();
});
