import {
	XAIRealtimeVoiceAdapter,
	type RealtimeVoiceClientEvent,
	type RealtimeVoiceServerEvent,
	type RealtimeVoiceSocket,
} from '../../../../src/main/models/adapters/realtime_voice';

class FakeSocket implements RealtimeVoiceSocket {
	readonly sent: RealtimeVoiceClientEvent[] = [];
	readonly socket = {
		readyState: 0,
		bufferedAmount: 0,
		on: (event: 'open' | 'close', listener: (...args: unknown[]) => void) => {
			this.socketListeners[event].push(listener);
		},
	};
	private readonly socketListeners = {
		open: [] as Array<() => void>,
		close: [] as Array<() => void>,
	};
	private readonly eventListeners: Array<(event: RealtimeVoiceServerEvent) => void> = [];

	on(
		event: 'event' | 'error',
		listener: ((event: RealtimeVoiceServerEvent) => void) | ((error: Error) => void)
	): void {
		if (event === 'event')
			this.eventListeners.push(listener as (event: RealtimeVoiceServerEvent) => void);
	}

	send(event: RealtimeVoiceClientEvent): void {
		this.sent.push(event);
	}

	close(): void {
		this.socketListeners.close.forEach((listener) => listener());
	}

	open(): void {
		this.socketListeners.open.forEach((listener) => listener());
	}

	event(event: RealtimeVoiceServerEvent): void {
		this.eventListeners.forEach((listener) => listener(event));
	}
}

describe('XAIRealtimeVoiceAdapter', () => {
	it('uses the xAI-compatible session shape and normalizes output events', async () => {
		const socket = new FakeSocket();
		const socketFactory = jest.fn(() => socket);
		const adapter = new XAIRealtimeVoiceAdapter(
			{
				id: 'xai',
				name: 'xAI',
				apiKey: 'xai-key',
			},
			socketFactory,
			1_000
		);
		const events: Array<{ type: string }> = [];
		const connecting = adapter.connect(
			{
				modelId: 'grok-voice-latest',
				voice: '',
				instructions: 'Help the user.',
				history: [
					{ role: 'user', text: 'Earlier question.' },
					{ role: 'assistant', text: 'Earlier answer.' },
				],
				tools: [
					{
						id: 'read',
						name: 'Read file',
						description: 'Read a file.',
						schema: { type: 'object' },
						timeoutMs: 1_000,
						maxOutputBytes: 1_000,
						parseInput: () => ({}),
						run: () => '',
					},
				],
			},
			(event) => events.push(event)
		);

		socket.open();
		expect(socketFactory).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'xai', apiKey: 'xai-key' }),
			'grok-voice-latest'
		);
		expect(socket.sent[0]).toMatchObject({
			type: 'session.update',
			session: {
				voice: 'eve',
				turn_detection: {
					type: 'server_vad',
					threshold: 0.5,
					prefix_padding_ms: 333,
					silence_duration_ms: 1_200,
				},
				parallel_tool_calls: false,
				audio: {
					input: {
						format: { type: 'audio/pcm', rate: 24_000 },
						transcription: { model: 'grok-transcribe' },
					},
					output: { format: { type: 'audio/pcm', rate: 24_000 } },
				},
				tools: [{ type: 'function', name: 'read' }],
			},
		});
		expect(socket.sent).toHaveLength(1);

		socket.event({ type: 'session.updated' });
		await connecting;
		expect(socket.sent.slice(1)).toEqual([
			{
				type: 'conversation.item.create',
				item: {
					type: 'message',
					role: 'user',
					content: [{ type: 'input_text', text: 'Earlier question.' }],
				},
			},
			{
				type: 'conversation.item.create',
				item: {
					type: 'message',
					role: 'assistant',
					content: [{ type: 'output_text', text: 'Earlier answer.' }],
				},
			},
		]);
		expect(socket.sent).not.toContainEqual({ type: 'response.create' });
		socket.event({
			type: 'conversation.item.input_audio_transcription.completed',
			item_id: 'user-item',
			transcript: 'Open the current file.',
		});
		expect(events).toContainEqual({
			type: 'user_transcript_final',
			itemId: 'user-item',
			transcript: 'Open the current file.',
		});
		socket.event({
			type: 'conversation.item.input_audio_transcription.updated',
			item_id: 'next-user-item',
			transcript: 'Open the corrected file.',
		});
		expect(events).toContainEqual({
			type: 'user_transcript_update',
			itemId: 'next-user-item',
			transcript: 'Open the corrected file.',
		});
		socket.event({
			type: 'response.output_audio_transcript.delta',
			response_id: 'response',
			item_id: 'item',
			delta: 'Hello',
		});
		expect(events).toContainEqual({
			type: 'assistant_transcript_delta',
			responseId: 'response',
			itemId: 'item',
			delta: 'Hello',
		});
	});

	it('waits for every parallel tool result before continuing once', async () => {
		const socket = new FakeSocket();
		const adapter = new XAIRealtimeVoiceAdapter(
			{ id: 'xai', name: 'xAI', apiKey: 'key' },
			() => socket,
			1_000
		);
		const connecting = adapter.connect(
			{
				modelId: 'grok-voice-latest',
				voice: 'eve',
				instructions: '',
				history: [],
				tools: [],
			},
			() => undefined
		);
		socket.open();
		socket.event({ type: 'session.updated' });
		const connection = await connecting;

		socket.event({ type: 'response.created', response: { id: 'response-1' } });
		for (const callId of ['call-1', 'call-2']) {
			socket.event({
				type: 'response.function_call_arguments.done',
				call_id: callId,
				item_id: `item-${callId}`,
				response_id: 'response-1',
				name: 'read',
				arguments: '{}',
			});
		}
		socket.event({ type: 'response.done', response: { id: 'response-1' } });
		await connection.addToolResult('call-1', 'first');
		expect(socket.sent.filter((event) => event.type === 'response.create')).toHaveLength(0);
		await connection.addToolResult('call-2', 'second');
		expect(socket.sent.filter((event) => event.type === 'response.create')).toHaveLength(1);
	});

	it('rejects models outside the stable xAI allow-list before opening a socket', async () => {
		const socketFactory = jest.fn(() => new FakeSocket());
		const adapter = new XAIRealtimeVoiceAdapter(
			{ id: 'xai', name: 'xAI', apiKey: 'key' },
			socketFactory
		);

		await expect(
			adapter.connect(
				{
					modelId: 'grok-voice-preview',
					voice: 'eve',
					instructions: '',
					history: [],
					tools: [],
				},
				() => undefined
			)
		).rejects.toThrow('not supported');
		expect(socketFactory).not.toHaveBeenCalled();
	});
});
