import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatSessionContext } from '../../../src/renderer/src/contexts/chat-session';
import { useHomeAgent } from '../../../src/renderer/src/pages/home/hooks/useHomeAgent';

const mockDispatch = jest.fn();

jest.mock('../../../src/renderer/src/pages/home/context', () => ({
	useHomeAgentContext: () => ({ chatState: {}, dispatchChat: mockDispatch }),
}));

jest.mock('../../../src/renderer/src/hooks/use-modes', () => ({ useModes: () => [] }));

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolve = (_value: T) => {};
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

it('generates the run id before send and reuses it for Stop', async () => {
	const response = deferred<string>();
	const send = jest.fn(() => response.promise);
	const cancel = jest.fn().mockResolvedValue(true);
	const runId = '11111111-1111-4111-8111-111111111111';
	Object.defineProperty(globalThis.crypto, 'randomUUID', {
		configurable: true,
		value: jest.fn(() => runId),
	});
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: {
			send,
			cancel,
			getLastMessages: jest.fn().mockResolvedValue([]),
			getSessionSnapshot: jest.fn().mockResolvedValue({ messages: [] }),
		},
	});

	function Harness() {
		const agent = useHomeAgent({ setMode: jest.fn() });
		return (
			<>
				<textarea value={agent.input} onChange={(event) => agent.setInput(event.target.value)} />
				<button onClick={() => agent.handleSubmit()}>
					{agent.isLoading ? 'Stop' : 'Send'}
				</button>
			</>
		);
	}

	render(
		<ChatSessionContext.Provider value={{ sessionId: 'home', setSessionId: jest.fn() }}>
			<Harness />
		</ChatSessionContext.Provider>
	);
	fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
	fireEvent.click(screen.getByRole('button', { name: 'Send' }));
	await waitFor(() => expect(send).toHaveBeenCalled());
	expect(send.mock.calls[0][1]).toMatchObject({
		runId,
		sessionId: 'home',
		interactionMode: 'plan',
	});

	fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
	await waitFor(() => expect(cancel).toHaveBeenCalledWith(runId));
	response.resolve('late reply');
});
