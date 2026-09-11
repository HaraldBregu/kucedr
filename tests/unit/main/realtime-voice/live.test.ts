import { OpenAILiveVoiceAdapter } from '../../../../src/main/models/adapters/realtime_voice';

class FakeLiveSocket {
	readonly bufferedAmount = 0;
	readonly sent: string[] = [];
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
		this.emit('close');
	}

	emit(event: keyof typeof this.listeners, ...args: unknown[]): void {
		this.listeners[event].forEach((listener) => listener(...args));
	}
}

describe('OpenAILiveVoiceAdapter', () => {
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
		socket.emit(
			'message',
			JSON.stringify({ type: 'session.output_audio.delta', delta: 'AQI=' })
		);
		socket.emit('message', JSON.stringify({ type: 'session.output_audio.done' }));

		expect(events).toEqual([
			{
				type: 'assistant_audio_delta',
				itemId: 'live-output',
				responseId: 'live-output',
				audio: 'AQI=',
			},
			{ type: 'assistant_audio_done', itemId: 'live-output', responseId: 'live-output' },
		]);
	});
});
