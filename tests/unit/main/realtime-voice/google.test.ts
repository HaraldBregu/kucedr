import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { createGoogleRealtimeVoiceAdapter } from '../../../../src/main/models/adapters/realtime_voice/google';
import type { RealtimeVoiceAdapterRequest } from '../../../../src/main/models/adapters/realtime_voice/realtime_voice_types';

class Socket extends EventEmitter {
	readyState = 1;
	bufferedAmount = 0;
	send = jest.fn();
	close = jest.fn(() => this.emit('close', 1000, Buffer.from('')));
	event(event: object): void { this.emit('message', JSON.stringify(event)); }
}

const request: RealtimeVoiceAdapterRequest = {
	modelId: 'gemini-3.8-live', voice: 'Kore', instructions: 'Help.', history: [], tools: [],
};

describe('Gemini Live voice', () => {
	it('waits for setup before replaying history and sends mono 24k audio', async () => {
		const socket = new Socket();
		const factory = jest.fn(() => socket as unknown as WebSocket);
		const adapter = createGoogleRealtimeVoiceAdapter({ id: 'google', name: 'Google', apiKey: 'key' }, factory);
		const connecting = adapter.connect({ ...request, history: [{ role: 'assistant', text: 'Earlier' }] }, jest.fn());
		socket.emit('open');
		const setup = JSON.parse(socket.send.mock.calls[0][0]).setup;
		expect(setup.model).toBe('models/gemini-3.8-live');
		expect(setup.generationConfig).not.toHaveProperty('thinkingConfig');
		expect(setup.historyConfig).toEqual({ initialHistoryInClientContent: true });
		expect(socket.send).toHaveBeenCalledTimes(1);
		socket.event({ setupComplete: {} });
		const connection = await connecting;
		expect(JSON.parse(socket.send.mock.calls[1][0])).toEqual({ clientContent: { turns: [{ role: 'model', parts: [{ text: 'Earlier' }] }], turnComplete: true } });
		await connection.appendAudio('aGVsbG8=');
		expect(JSON.parse(socket.send.mock.calls[2][0])).toEqual({ realtimeInput: { audio: { data: 'aGVsbG8=', mimeType: 'audio/pcm;rate=24000' } } });
		await connection.stop();
	});

	it('keeps listening during background reasoning and consumes every audio part', async () => {
		const socket = new Socket();
		const emit = jest.fn();
		const adapter = createGoogleRealtimeVoiceAdapter({ id: 'google', name: 'Google', apiKey: 'key' }, () => socket as unknown as WebSocket);
		const connecting = adapter.connect({ ...request, modelId: 'gemini-3.8-live-extended-thinking' }, emit);
		socket.emit('open'); socket.event({ setupComplete: {} });
		const connection = await connecting;
		expect(JSON.parse(socket.send.mock.calls[0][0]).setup.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
		socket.event({ serverContent: { outputTranscription: { text: 'Hello' }, modelTurn: { parts: [
			{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'first' } },
			{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'second' } },
		] }, turnComplete: true, interactionStatus: 'IN_PROGRESS' } });
		expect(emit.mock.calls.filter(([event]) => event.type === 'assistant_audio_delta').map(([event]) => event.audio)).toEqual(['first', 'second']);
		expect(emit.mock.calls.some(([event]) => event.type === 'response_done')).toBe(false);
		socket.event({ serverContent: { outputTranscription: { text: ' again' }, turnComplete: true, interactionStatus: 'IDLE' } });
		expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'assistant_transcript_final', transcript: 'Hello again' }));
		expect(emit.mock.calls.filter(([event]) => event.type === 'response_done')).toHaveLength(1);
		await connection.stop();
	});

	it('maps tool requests and ignores results for cancelled calls', async () => {
		const socket = new Socket(); const emit = jest.fn();
		const adapter = createGoogleRealtimeVoiceAdapter({ id: 'google', name: 'Google', apiKey: 'key' }, () => socket as unknown as WebSocket);
		const connecting = adapter.connect({ ...request, tools: [{ id: 'read', description: 'Read', schema: { type: 'object' } } as RealtimeVoiceAdapterRequest['tools'][number]] }, emit);
		socket.emit('open'); socket.event({ setupComplete: {} });
		const connection = await connecting;
		expect(JSON.parse(socket.send.mock.calls[0][0]).setup.tools[0].functionDeclarations[0]).toMatchObject({ name: 'read', behavior: 'NON_BLOCKING', parametersJsonSchema: { type: 'object' } });
		socket.event({ toolCall: { functionCalls: [{ id: 'call', name: 'read', args: { path: 'file' } }] } });
		expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tool_call', callId: 'call', name: 'read', arguments: '{"path":"file"}' }));
		await connection.addToolResult('call', 'contents');
		expect(JSON.parse(socket.send.mock.calls[1][0])).toEqual({ toolResponse: { functionResponses: [{ id: 'call', name: 'read', response: { result: 'contents' } }] } });
		socket.event({ toolCall: { functionCalls: [{ id: 'cancel', name: 'read' }] } });
		socket.event({ toolCallCancellation: { ids: ['cancel'] } });
		await connection.addToolResult('cancel', 'ignored');
		expect(socket.send).toHaveBeenCalledTimes(2);
		await connection.interrupt();
		expect(JSON.parse(socket.send.mock.calls[2][0])).toEqual({ clientContent: { turns: [], turnComplete: true } });
		await connection.stop();
	});

	it('rejects setup failures and aborts the socket', async () => {
		const socket = new Socket();
		const adapter = createGoogleRealtimeVoiceAdapter({ id: 'google', name: 'Google', apiKey: 'key' }, () => socket as unknown as WebSocket);
		const connecting = adapter.connect(request, jest.fn());
		socket.emit('open'); socket.event({ error: { message: 'Invalid voice' } });
		await expect(connecting).rejects.toThrow('Invalid voice');
		expect(socket.close).toHaveBeenCalled();
	});
});
