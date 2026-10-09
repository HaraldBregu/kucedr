import {
	OpenAIRealtimeVoiceAdapter,
	type RealtimeVoiceClientEvent,
	type RealtimeVoiceServerEvent,
	type RealtimeVoiceSocket,
} from '../../../../src/main/models/adapters/realtime_voice';

class FakeSocket implements RealtimeVoiceSocket {
	readonly sent: RealtimeVoiceClientEvent[] = [];
	closed = false;
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
	private readonly errorListeners: Array<(error: Error) => void> = [];

	on(
		event: 'event' | 'error',
		listener: ((event: RealtimeVoiceServerEvent) => void) | ((error: Error) => void)
	): void {
		if (event === 'event')
			this.eventListeners.push(listener as (event: RealtimeVoiceServerEvent) => void);
		else this.errorListeners.push(listener as (error: Error) => void);
	}

	send(event: RealtimeVoiceClientEvent): void {
		this.sent.push(event);
	}

	close(): void {
		this.closed = true;
		this.socketListeners.close.forEach((listener) => listener());
	}

	open(): void {
		this.socketListeners.open.forEach((listener) => listener());
	}

	disconnect(code: number, reason: string): void {
		this.socketListeners.close.forEach((listener) => listener(code, reason));
	}

	event(event: RealtimeVoiceServerEvent): void {
		this.eventListeners.forEach((listener) => listener(event));
	}

	error(error: Error): void {
		this.errorListeners.forEach((listener) => listener(error));
	}
}

describe('OpenAIRealtimeVoiceAdapter', () => {
	it('refreshes remembered context before each response and discards it after cancellation', async () => {
		const socket = new FakeSocket();
		let resolveContext: (value: string) => void = () => undefined;
		const contextForTurn = jest.fn(
			() =>
				new Promise<string>((resolve) => {
					resolveContext = resolve;
				})
		);
		const adapter = new OpenAIRealtimeVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			1000
		);
		const connecting = adapter.connect(
			{
				modelId: 'gpt-realtime-2.1',
				voice: 'marin',
				instructions: 'Help.',
				history: [],
				tools: [],
				contextForTurn,
			},
			() => undefined
		);
		socket.open();
		expect(socket.sent[0]).toMatchObject({
			session: { audio: { input: { turn_detection: { create_response: false } } } },
		});
		socket.event({ type: 'session.updated' });
		const connection = await connecting;
		socket.event({ type: 'input_audio_buffer.speech_started', item_id: 'one' });
		socket.event({
			type: 'conversation.item.input_audio_transcription.completed',
			item_id: 'one',
			transcript: 'What are my preferences?',
		});
		expect(contextForTurn).toHaveBeenCalledWith('What are my preferences?');
		expect(socket.sent.some((event) => event.type === 'response.create')).toBe(false);
		resolveContext('Prefers concise answers');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(socket.sent.at(-2)).toMatchObject({
			type: 'conversation.item.create',
			item: {
				id: expect.stringMatching(/^memory_[0-9a-f]{25}$/),
				role: 'user',
				content: [{ type: 'input_text', text: expect.stringContaining('Prefers concise answers') }],
			},
		});
		expect(socket.sent.at(-1)).toEqual({ type: 'response.create' });
		socket.event({ type: 'input_audio_buffer.speech_started', item_id: 'two' });
		socket.event({
			type: 'conversation.item.input_audio_transcription.completed',
			item_id: 'two',
			transcript: 'New topic',
		});
		resolveContext('Different preference');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(socket.sent.filter((event) => event.type === 'conversation.item.delete')).toHaveLength(
			1
		);
		socket.event({ type: 'input_audio_buffer.speech_started', item_id: 'three' });
		socket.event({
			type: 'conversation.item.input_audio_transcription.completed',
			item_id: 'three',
			transcript: 'Stop',
		});
		await connection.stop();
		const count = socket.sent.length;
		resolveContext('Must not send');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(socket.sent).toHaveLength(count);
	});

	it('continues a voice response when context lookup fails', async () => {
		const socket = new FakeSocket();
		const adapter = new OpenAIRealtimeVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			1000
		);
		const connecting = adapter.connect(
			{
				modelId: 'gpt-realtime-2.1',
				voice: 'marin',
				instructions: '',
				history: [],
				tools: [],
				contextForTurn: async () => {
					throw new Error('Unavailable');
				},
			},
			() => undefined
		);
		socket.open();
		socket.event({ type: 'session.updated' });
		await connecting;
		socket.event({
			type: 'conversation.item.input_audio_transcription.completed',
			item_id: 'one',
			transcript: 'Hello',
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(socket.sent.at(-1)).toEqual({ type: 'response.create' });
	});

	it.each(['gpt-realtime-2.1', 'gpt-realtime-2.1-mini'])('configures %s and forwards streamed output', async (modelId) => {
		const socket = new FakeSocket();
		const adapter = new OpenAIRealtimeVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			1_000
		);
		const events: Array<{ type: string }> = [];
		const connecting = adapter.connect(
			{
				modelId,
				voice: 'marin',
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
		expect(socket.sent[0]).toMatchObject({
			type: 'session.update',
			session: {
				model: modelId,
				audio: {
					input: {
						format: { type: 'audio/pcm', rate: 24_000 },
						transcription: { model: 'gpt-4o-mini-transcribe' },
						turn_detection: {
							type: 'server_vad',
							silence_duration_ms: 1_200,
							create_response: true,
							interrupt_response: true,
						},
					},
					output: { format: { type: 'audio/pcm', rate: 24_000 }, voice: 'marin' },
				},
				tools: [{ type: 'function', name: 'read' }],
			},
		});
		expect(socket.sent).toHaveLength(1);
		socket.event({ type: 'session.updated' });
		const connection = await connecting;
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
					content: [{ type: 'text', text: 'Earlier answer.' }],
				},
			},
		]);
		expect(socket.sent).not.toContainEqual({ type: 'response.create' });
		expect(socket.sent).toHaveLength(3);
		socket.event({
			type: 'conversation.item.input_audio_transcription.completed',
			item_id: 'user-item',
			transcript: 'Please inspect the repository.',
		});
		expect(events).toContainEqual({
			type: 'user_transcript_final',
			itemId: 'user-item',
			transcript: 'Please inspect the repository.',
		});
		socket.event({
			type: 'response.output_audio.delta',
			response_id: 'response',
			item_id: 'item',
			delta: 'AQI=',
		});
		expect(events).toContainEqual({
			type: 'assistant_audio_delta',
			responseId: 'response',
			itemId: 'item',
			audio: 'AQI=',
		});

		await connection.addToolResult('call', 'ok');
		expect(socket.sent.slice(-2)).toEqual([
			{
				type: 'conversation.item.create',
				item: { type: 'function_call_output', call_id: 'call', output: 'ok' },
			},
			{ type: 'response.create' },
		]);

		await connection.interrupt();
		expect(socket.sent.at(-1)).toEqual({ type: 'response.create' });
		socket.event({
			type: 'response.created',
			response: { id: 'response' },
		});
		expect(events).toContainEqual({ type: 'response_started', responseId: 'response' });
		await connection.interrupt();
		expect(socket.sent.at(-1)).toEqual({ type: 'response.cancel' });

		socket.socket.bufferedAmount = 1_400_000;
		await expect(connection.appendAudio('AAAA')).rejects.toThrow('transport queue is full');
	});

	it('reports SDK protocol errors once and gives actionable authentication failures', async () => {
		const socket = new FakeSocket();
		const events: Array<{ type: string; message?: string }> = [];
		const adapter = new OpenAIRealtimeVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' }, () => socket, 1000
		);
		const connecting = adapter.connect(
			{ modelId: 'gpt-realtime-2.1', voice: 'marin', instructions: '', history: [], tools: [] },
			(event) => events.push(event)
		);
		socket.error(new Error('Unexpected server response: 401'));
		await expect(connecting).rejects.toThrow(/OpenAI.*API key.*401/);
		expect(events.filter((event) => event.type === 'error')).toHaveLength(0);

		const next = new FakeSocket();
		const pending = new OpenAIRealtimeVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' }, () => next, 1000
		).connect(
			{ modelId: 'gpt-realtime-2.1', voice: 'marin', instructions: '', history: [], tools: [] },
			(event) => events.push(event)
		);
		next.open();
		next.event({ type: 'session.updated' });
		const connection = await pending;
		const error = { message: 'Invalid command.', code: 'invalid_request' };
		next.event({ type: 'error', error });
		next.error(Object.assign(new Error('Invalid command. code=invalid_request'), { error }));
		expect(events.filter((event) => event.type === 'error')).toEqual([
			{ type: 'error', message: 'Invalid command.' },
		]);
		await connection.stop();
	});

	it('fails startup after the bounded connection timeout', async () => {
		jest.useFakeTimers();
		const socket = new FakeSocket();
		const adapter = new OpenAIRealtimeVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			15_000
		);
		const connecting = adapter.connect(
			{
				modelId: 'gpt-realtime-2.1-mini',
				voice: 'marin',
				instructions: '',
				history: [],
				tools: [],
			},
			() => undefined
		);
		jest.advanceTimersByTime(15_000);
		await expect(connecting).rejects.toThrow('timed out');
		jest.useRealTimers();
	});

	it('rejects and closes immediately when setup returns a protocol error', async () => {
		const socket = new FakeSocket();
		const adapter = new OpenAIRealtimeVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			15_000
		);
		const connecting = adapter.connect(
			{
				modelId: 'gpt-realtime-2.1',
				voice: 'marin',
				instructions: '',
				history: [],
				tools: [],
			},
			() => undefined
		);
		socket.open();
		socket.event({ type: 'error', error: { message: 'Invalid session configuration.' } });

		await expect(connecting).rejects.toThrow('Invalid session configuration.');
		expect(socket.closed).toBe(true);
	});

	it('surfaces an abnormal provider close after setup', async () => {
		const socket = new FakeSocket();
		const events: Array<{ type: string; message?: string }> = [];
		const adapter = new OpenAIRealtimeVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			1_000
		);
		const connecting = adapter.connect(
			{
				modelId: 'gpt-realtime-2.1',
				voice: 'marin',
				instructions: '',
				history: [],
				tools: [],
			},
			(event) => events.push(event)
		);
		socket.open();
		socket.event({ type: 'session.updated' });
		await connecting;

		socket.disconnect(1008, 'API key is not authorized for realtime voice');

		expect(events).toContainEqual({
			type: 'error',
			message:
				'Realtime voice connection closed (API key is not authorized for realtime voice).',
		});
	});

	it('surfaces a failed response after speech stops', async () => {
		const socket = new FakeSocket();
		const events: Array<{ type: string; message?: string }> = [];
		const adapter = new OpenAIRealtimeVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			1_000
		);
		const connecting = adapter.connect(
			{
				modelId: 'gpt-realtime-2.1',
				voice: 'marin',
				instructions: '',
				history: [],
				tools: [],
			},
			(event) => events.push(event)
		);
		socket.open();
		socket.event({ type: 'session.updated' });
		await connecting;
		socket.event({ type: 'response.created', response: { id: 'response-1' } });

		socket.event({
			type: 'response.done',
			response: {
				id: 'response-1',
				status: 'failed',
				status_details: { error: { message: 'The realtime response was rejected.' } },
			},
		});

		expect(events).toContainEqual({
			type: 'error',
			message: 'The realtime response was rejected.',
		});
	});

	it('closes and rejects setup immediately when the owner aborts', async () => {
		const socket = new FakeSocket();
		const adapter = new OpenAIRealtimeVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			15_000
		);
		const controller = new AbortController();
		const connecting = adapter.connect(
			{
				modelId: 'gpt-realtime-2.1',
				voice: 'marin',
				instructions: '',
				history: [],
				tools: [],
			},
			() => undefined,
			controller.signal
		);
		controller.abort(new DOMException('Window closed.', 'AbortError'));

		await expect(connecting).rejects.toThrow('Window closed.');
		expect(socket.closed).toBe(true);
	});
});
