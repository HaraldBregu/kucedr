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
				history: [{ role: 'user', text: 'Earlier discussion.' }],
				tools: [],
				contextForTurn,
			},
			() => undefined
		);
		socket.emit('open');
		socket.emit('message', JSON.stringify({ type: 'session.started' }));
		await connecting;
		expect(socket.sent.map((event) => JSON.parse(event))).toContainEqual(
			expect.objectContaining({
				type: 'session.thinking.append',
				delegation_id: null,
				content: expect.stringContaining('Earlier discussion.'),
			})
		);
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

	it('returns to listening after the live output audio completes', async () => {
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
		socket.emit('message', JSON.stringify({ type: 'session.output_audio.delta', delta: 'AQI=' }));
		socket.emit('message', JSON.stringify({ type: 'session.output_audio.done' }));

		expect(events).toEqual([
			{
				type: 'assistant_audio_delta',
				itemId: 'live-output-0',
				responseId: 'live-output-0',
				audio: 'AQI=',
			},
			{ type: 'assistant_audio_done', itemId: 'live-output-0', responseId: 'live-output-0' },
		]);
	});

	it('emits separate user and assistant transcript items for each turn', async () => {
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
			socket.emit('message', JSON.stringify({ type: 'session.output_audio.done' }));
		}

		expect(events.filter((event) => event.type === 'user_transcript_final')).toEqual([
			expect.objectContaining({ itemId: 'live-input-0', transcript: 'First user message' }),
			expect.objectContaining({ itemId: 'live-input-1', transcript: 'Second user message' }),
		]);
		expect(events.filter((event) => event.type === 'assistant_transcript_final')).toEqual([
			expect.objectContaining({ itemId: 'live-output-0', transcript: 'First assistant message' }),
			expect.objectContaining({ itemId: 'live-output-1', transcript: 'Second assistant message' }),
		]);
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
});
