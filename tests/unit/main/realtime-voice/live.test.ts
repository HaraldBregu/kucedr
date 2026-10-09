import { OpenAILiveVoiceAdapter } from '../../../../src/main/models/adapters/realtime_voice';

class FakeLiveSocket {
	readonly bufferedAmount = 0;
	readonly sent: string[] = [];
	closed = false;
	private readonly listeners = {
		close: [] as Array<(...args: unknown[]) => void>,
		error: [] as Array<(...args: unknown[]) => void>,
		message: [] as Array<(...args: unknown[]) => void>,
		open: [] as Array<(...args: unknown[]) => void>,
	};

	on(event: keyof typeof this.listeners, listener: (...args: unknown[]) => void): void {
		this.listeners[event].push(listener);
	}

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		this.closed = true;
		this.emit('close');
	}

	emit(event: keyof typeof this.listeners, ...args: unknown[]): void {
		this.listeners[event].forEach((listener) => listener(...args));
	}
}

describe('OpenAILiveVoiceAdapter', () => {
	it('restores history and refreshes context from incoming transcripts outside instructions', async () => {
		const socket = new FakeLiveSocket();
		const contextForTurn = jest.fn(async () => 'User prefers concise answers.');
		const adapter = new OpenAILiveVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			1000
		);
		const connecting = adapter.connect(
			{
				modelId: 'gpt-live-1',
				voice: 'marin',
				instructions: 'Help.',
				history: [{ role: 'user', text: 'Earlier discussion.' }, { role: 'assistant', text: 'Earlier answer.' }],
				tools: [],
				contextForTurn,
			},
			() => undefined
		);
		socket.emit('open');
		socket.emit('message', JSON.stringify({ type: 'session.started' }));
		await connecting;
		expect(JSON.parse(socket.sent[0]).session.input).toEqual([
			{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Earlier discussion.' }] },
			{ type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Earlier answer.' }] },
		]);
		socket.emit(
			'message',
			JSON.stringify({ type: 'session.input_transcript.delta', delta: 'What style do I prefer?' })
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(contextForTurn).toHaveBeenCalledWith('What style do I prefer?');
		expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({
			type: 'session.thinking.append',
			content: expect.stringContaining('User prefers concise answers.'),
		});
		expect(JSON.parse(socket.sent[0]).session.instructions).toBe('Help.');
	});

	it('ignores continuous silent audio and completes spoken output without a server done event', async () => {
		jest.useFakeTimers();
		const socket = new FakeLiveSocket();
		const events: Array<{ type: string }> = [];
		const adapter = new OpenAILiveVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			1_000
		);
		const connecting = adapter.connect(
			{ modelId: 'gpt-live-1', voice: 'marin', instructions: '', history: [], tools: [] },
			(event) => events.push(event)
		);

		socket.emit('open');
		socket.emit('message', JSON.stringify({ type: 'session.started' }));
		await connecting;
		socket.emit('message', JSON.stringify({ type: 'session.output_audio.delta', delta: 'AAA=' }));
		expect(events).toEqual([]);
		socket.emit('message', JSON.stringify({ type: 'session.output_audio.delta', delta: 'AQI=' }));
		socket.emit('message', JSON.stringify({ type: 'session.output_transcript.delta', delta: 'Hello.' }));
		for (let index = 0; index < 20; index += 1) {
			await jest.advanceTimersByTimeAsync(100);
			socket.emit('message', JSON.stringify({ type: 'session.output_audio.delta', delta: 'AAA=' }));
		}

		expect(events).toContainEqual({
				type: 'assistant_audio_delta',
				itemId: 'live-output-0',
				responseId: 'live-output-0',
				audio: 'AQI=',
		});
		expect(events).toContainEqual({ type: 'assistant_audio_done', itemId: 'live-output-0', responseId: 'live-output-0' });
		expect(events).toContainEqual({ type: 'assistant_transcript_final', itemId: 'live-output-0', responseId: 'live-output-0', transcript: 'Hello.' });
		expect(events.filter((event) => event.type === 'assistant_audio_done')).toHaveLength(1);
		jest.useRealTimers();
	});

	it('emits separate user and assistant transcript items for each turn', async () => {
		jest.useFakeTimers();
		const socket = new FakeLiveSocket();
		const events: Array<{ type: string; itemId?: string; transcript?: string }> = [];
		const adapter = new OpenAILiveVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			1_000
		);
		const connecting = adapter.connect(
			{ modelId: 'gpt-live-1', voice: 'marin', instructions: '', history: [], tools: [] },
			(event) => events.push(event)
		);

		socket.emit('open');
		socket.emit('message', JSON.stringify({ type: 'session.started' }));
		await connecting;

		for (const [user, assistant] of [
			['First user message', 'First assistant message'],
			['Second user message', 'Second assistant message'],
		]) {
			socket.emit(
				'message',
				JSON.stringify({ type: 'session.input_transcript.delta', delta: user })
			);
			socket.emit(
				'message',
				JSON.stringify({ type: 'session.output_transcript.delta', delta: assistant })
			);
			await jest.advanceTimersByTimeAsync(2000);
		}

		expect(events.filter((event) => event.type === 'user_transcript_final')).toEqual([
			expect.objectContaining({ itemId: 'live-input-0', transcript: 'First user message' }),
			expect.objectContaining({ itemId: 'live-input-1', transcript: 'Second user message' }),
		]);
		expect(events.filter((event) => event.type === 'assistant_transcript_final')).toEqual([
			expect.objectContaining({ itemId: 'live-output-0', transcript: 'First assistant message' }),
			expect.objectContaining({ itemId: 'live-output-1', transcript: 'Second assistant message' }),
		]);
		jest.useRealTimers();
	});

	it('interrupts Live speech with the supported instruction command and closes after transport failure', async () => {
		const socket = new FakeLiveSocket();
		const events: Array<{ type: string }> = [];
		const adapter = new OpenAILiveVoiceAdapter({ id: 'openai', name: 'OpenAI', apiKey: 'key' }, () => socket, 1000);
		const connecting = adapter.connect({ modelId: 'gpt-live-1', voice: 'cedar', instructions: '', history: [], tools: [] }, (event) => events.push(event));
		socket.emit('open');
		socket.emit('message', JSON.stringify({ type: 'session.started' }));
		const connection = await connecting;
		socket.emit('message', JSON.stringify({ type: 'session.output_audio.delta', delta: 'AQI=' }));
		await connection.interrupt();
		expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({ type: 'session.instructions.append', delegation_id: null, content: expect.stringContaining('Stop speaking') });
		socket.emit('message', JSON.stringify({ type: 'session.closed' }));
		expect(socket.closed).toBe(true);
		expect(events).toContainEqual({ type: 'closed' });
		const failing = new FakeLiveSocket();
		const pending = new OpenAILiveVoiceAdapter({ id: 'openai', name: 'OpenAI', apiKey: 'key' }, () => failing, 1000).connect({ modelId: 'gpt-live-1', voice: '', instructions: '', history: [], tools: [] }, () => undefined);
		failing.emit('error', new Error('Unexpected server response: 401'));
		await expect(pending).rejects.toThrow(/OpenAI.*API key.*401/);
		expect(failing.closed).toBe(true);
	});

	it('rejects and closes immediately when setup returns a protocol error', async () => {
		const socket = new FakeLiveSocket();
		const adapter = new OpenAILiveVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			15_000
		);
		const connecting = adapter.connect(
			{ modelId: 'gpt-live-1', voice: 'marin', instructions: '', history: [], tools: [] },
			() => undefined
		);
		socket.emit('open');
		socket.emit(
			'message',
			JSON.stringify({ type: 'error', error: { message: 'Invalid Live configuration.' } })
		);

		await expect(connecting).rejects.toThrow('Invalid Live configuration.');
		expect(socket.closed).toBe(true);
	});

	it('surfaces an abnormal provider close after setup', async () => {
		const socket = new FakeLiveSocket();
		const events: Array<{ type: string; message?: string }> = [];
		const adapter = new OpenAILiveVoiceAdapter(
			{ id: 'openai', name: 'OpenAI', apiKey: 'key' },
			() => socket,
			1_000
		);
		const connecting = adapter.connect(
			{ modelId: 'gpt-live-1', voice: 'marin', instructions: '', history: [], tools: [] },
			(event) => events.push(event)
		);
		socket.emit('open');
		socket.emit('message', JSON.stringify({ type: 'session.started' }));
		await connecting;

		socket.emit('close', 1008, Buffer.from('API key is not authorized for Live voice'));

		expect(events).toContainEqual({
			type: 'error',
			message: 'Live voice connection closed (API key is not authorized for Live voice).',
		});
	});
});
