import { act, renderHook, waitFor } from '@testing-library/react';
import { useHomeAgent } from '../../../src/renderer/src/pages/home/hooks/useHomeAgent';

const mockDispatch = jest.fn();
const mockSetMode = jest.fn();
const mockSetSessionId = jest.fn();
let mockSessionId = 'chat-one';
const send = jest.fn();
const firstMessage = { id: 'assistant-one', content: 'First suggestion.\nMore details.' };
const secondMessage = { id: 'assistant-two', content: 'Another suggestion.' };

jest.mock('../../../src/renderer/src/pages/home/context', () => ({
	useHomeAgentContext: () => ({ chatState: { messages: [] }, dispatchChat: mockDispatch }),
}));

jest.mock('../../../src/renderer/src/contexts/chat-session', () => ({
	useChatSession: () => ({ sessionId: mockSessionId, setSessionId: mockSetSessionId }),
}));

beforeEach(() => {
	mockSessionId = 'chat-one';
	send.mockResolvedValue('Assistant response');
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: {
			send,
			cancel: jest.fn().mockResolvedValue(true),
			getSessionSnapshot: jest.fn().mockResolvedValue({ messages: [] }),
		},
	});
});

it('selects and replaces the reply target while preserving the draft and focusing the editor', async () => {
	const { result } = renderHook(() => useHomeAgent({ setMode: mockSetMode }));
	const focus = jest.fn();
	result.current.inputRef.current = { focus } as unknown as HTMLTextAreaElement;
	await act(async () => {
		result.current.setInput('My unfinished reply');
		result.current.replyToMessage(firstMessage);
	});

	expect(result.current.replyTo).toEqual(firstMessage);
	expect(result.current.input).toBe('My unfinished reply');
	expect(mockSetMode).toHaveBeenCalledWith('chat');
	await waitFor(() => expect(focus).toHaveBeenCalled());

	act(() => result.current.replyToMessage(secondMessage));
	expect(result.current.replyTo).toEqual(secondMessage);
	expect(result.current.input).toBe('My unfinished reply');

	act(() => result.current.clearReply());
	expect(result.current.replyTo).toBeNull();
	expect(result.current.input).toBe('My unfinished reply');
});

it('sends the selected context and displays the same quote without modifying the draft sent to the API', async () => {
	const { result } = renderHook(() => useHomeAgent({ setMode: mockSetMode }));
	await act(async () => {
		result.current.setInput('Please explain the first suggestion.');
		result.current.replyToMessage(firstMessage);
	});
	await act(async () => {
		expect(await result.current.handleSubmit()).toBe(true);
	});

	expect(send).toHaveBeenCalledWith(
		'Please explain the first suggestion.',
		expect.objectContaining({ replyTo: firstMessage.content, sessionId: 'chat-one' }),
		expect.any(Function)
	);
	expect(mockDispatch).toHaveBeenCalledWith(
		expect.objectContaining({
			type: 'submit_user_message',
			content:
				'> **Replying to Kucedr**\n>\n> First suggestion.\n> More details.\n\nPlease explain the first suggestion.',
		})
	);
	expect(result.current.replyTo).toBeNull();
	expect(result.current.input).toBe('');
});

it('does not send an empty reply or discard its selected context', async () => {
	const { result } = renderHook(() => useHomeAgent({ setMode: mockSetMode }));
	await act(async () => result.current.replyToMessage(firstMessage));
	await act(async () => {
		expect(await result.current.handleSubmit()).toBe(false);
	});
	expect(send).not.toHaveBeenCalled();
	expect(result.current.replyTo).toEqual(firstMessage);
});

it('keeps goal commands separate from reply context', async () => {
	const { result } = renderHook(() => useHomeAgent({ setMode: mockSetMode }));
	await act(async () => {
		result.current.setInput('/goal Implement this suggestion');
		result.current.replyToMessage(secondMessage);
	});
	await act(async () => {
		await result.current.handleSubmit();
	});
	expect(send).toHaveBeenCalledWith(
		'/goal Implement this suggestion',
		expect.objectContaining({ replyTo: secondMessage.content }),
		expect.any(Function)
	);
	expect(mockDispatch).toHaveBeenCalledWith(
		expect.objectContaining({
			type: 'submit_user_message',
			content: '> **Replying to Kucedr**\n>\n> Another suggestion.\n\nImplement this suggestion',
		})
	);
});

it('clears reply context when changing sessions or resetting the chat', async () => {
	const { result, rerender } = renderHook(() => useHomeAgent({ setMode: mockSetMode }));
	await act(async () => result.current.replyToMessage(firstMessage));
	mockSessionId = 'chat-two';
	rerender();
	expect(result.current.replyTo).toBeNull();
	await act(async () => result.current.replyToMessage(secondMessage));
	act(() => result.current.resetChat());
	expect(result.current.replyTo).toBeNull();
});

it('preserves the pending reply when implementing a plan', async () => {
	const { result } = renderHook(() => useHomeAgent({ setMode: mockSetMode }));
	await act(async () => {
		result.current.setInput('Draft for later');
		result.current.replyToMessage(firstMessage);
	});
	await act(async () => result.current.implementPlan());
	expect(send.mock.calls[0][1]).not.toHaveProperty('replyTo');
	expect(result.current.replyTo).toEqual(firstMessage);
	expect(result.current.input).toBe('Draft for later');
});
