import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { createQwenRealtimeVoiceAdapter } from '../../../../src/main/models/adapters/realtime_voice/qwen';
import { createPcmResampler } from '../../../../src/main/models/adapters/realtime_voice/resample';
import type { RealtimeVoiceAdapterEvent } from '../../../../src/main/models/adapters/realtime_voice/realtime_voice_types';

const provider = { id: 'qwen', name: 'Qwen', apiKey: 'test-key' };
const request = {
	modelId: 'qwen3.8-omni-flash-realtime',
	voice: '',
	instructions: 'Help the user.',
	tools: [],
	history: [{ role: 'user' as const, text: 'Prior request' }],
	options: { workspace_id: 'workspace-1', region: 'cn-beijing', temperature: 0.6 },
};
let socket: EventEmitter & {
	readyState: number;
	bufferedAmount: number;
	send: jest.Mock;
	close: jest.Mock;
};
let socketFactory: jest.Mock;

beforeEach(() => {
	socket = Object.assign(new EventEmitter(), {
		readyState: 0,
		bufferedAmount: 0,
		send: jest.fn(),
		close: jest.fn(),
	});
	socketFactory = jest.fn(() => socket as unknown as WebSocket);
});

it('uses the required workspace endpoint and documented session schema', async () => {
	const connecting = createQwenRealtimeVoiceAdapter(provider, socketFactory).connect(
		request,
		jest.fn()
	);
	socket.readyState = 1;
	socket.emit('open');
	expect(socketFactory).toHaveBeenCalledWith(
		'wss://workspace-1.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=qwen3.8-omni-flash-realtime',
		{ headers: { Authorization: 'Bearer test-key' } }
	);
	expect(JSON.parse(socket.send.mock.calls[0]![0])).toMatchObject({
		type: 'session.update',
		event_id: expect.any(String),
		session: {
			instructions: expect.stringContaining('Prior request'),
			temperature: 0.6,
			input_audio_transcription: { model: 'qwen3-asr-flash-realtime' },
			audio: {
				input: { format: { sample_rate: 16000, channels: 1 } },
				output: { voice: 'Tina', format: { sample_rate: 24000 } },
			},
		},
	});
	socket.emit('message', Buffer.from(JSON.stringify({ type: 'session.updated' })));
	const connection = await connecting;
	expect(socket.send).toHaveBeenCalledTimes(1);
	await connection.stop();
});

it('normalizes transcript previews and native audio events', async () => {
	const events: RealtimeVoiceAdapterEvent[] = [];
	const connecting = createQwenRealtimeVoiceAdapter(provider, socketFactory).connect(
		request,
		(event) => events.push(event)
	);
	socket.emit('open');
	socket.emit('message', Buffer.from(JSON.stringify({ type: 'session.updated' })));
	const connection = await connecting;
	socket.emit(
		'message',
		Buffer.from(
			JSON.stringify({
				type: 'conversation.item.input_audio_transcription.delta',
				item_id: 'input',
				text: 'hello',
				stash: ' world',
			})
		)
	);
	socket.emit(
		'message',
		Buffer.from(
			JSON.stringify({
				type: 'response.audio.delta',
				item_id: 'audio',
				response_id: 'response',
				delta: 'QQ==',
			})
		)
	);
	socket.emit(
		'message',
		Buffer.from(
			JSON.stringify({
				type: 'response.audio_transcript.done',
				item_id: 'audio',
				response_id: 'response',
				transcript: 'Hello back',
			})
		)
	);
	expect(events).toContainEqual({
		type: 'user_transcript_update',
		itemId: 'input',
		transcript: 'hello world',
	});
	expect(events).toContainEqual({
		type: 'assistant_audio_delta',
		itemId: 'audio',
		responseId: 'response',
		audio: 'QQ==',
	});
	expect(events).toContainEqual({
		type: 'assistant_transcript_final',
		itemId: 'audio',
		responseId: 'response',
		transcript: 'Hello back',
	});
	await connection.stop();
});

it('returns tool output and continues after the native response finishes', async () => {
	const tool = {
		id: 'read',
		name: 'Read',
		description: 'Read a file',
		schema: { type: 'object' },
		timeoutMs: 1000,
		maxOutputBytes: 1000,
		parseInput: () => ({}),
		run: () => '',
	};
	const events = jest.fn();
	const connecting = createQwenRealtimeVoiceAdapter(provider, socketFactory).connect(
		{ ...request, tools: [tool] },
		events
	);
	socket.emit('open');
	expect(JSON.parse(socket.send.mock.calls[0]![0]).session.tools).toEqual([
		{
			type: 'function',
			function: { name: 'read', description: 'Read a file', parameters: { type: 'object' } },
		},
	]);
	socket.emit('message', Buffer.from(JSON.stringify({ type: 'session.updated' })));
	const connection = await connecting;
	socket.emit(
		'message',
		Buffer.from(
			JSON.stringify({
				type: 'response.function_call_arguments.done',
				call_id: 'call',
				item_id: 'tool',
				response_id: 'response',
				name: 'read',
				arguments: '{}',
			})
		)
	);
	expect(events).toHaveBeenCalledWith({
		type: 'tool_call',
		callId: 'call',
		itemId: 'tool',
		responseId: 'response',
		name: 'read',
		arguments: '{}',
	});
	await connection.addToolResult('call', 'file contents');
	expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toMatchObject({
		type: 'conversation.item.create',
		item: { type: 'function_call_output', call_id: 'call', output: 'file contents' },
	});
	socket.emit(
		'message',
		Buffer.from(
			JSON.stringify({ type: 'response.done', response: { id: 'response', status: 'completed' } })
		)
	);
	expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toMatchObject({ type: 'response.create' });
	await connection.stop();
});

it('resamples microphone audio to 16 kHz across chunk boundaries', async () => {
	const connecting = createQwenRealtimeVoiceAdapter(provider, socketFactory).connect(
		request,
		jest.fn()
	);
	socket.emit('open');
	socket.emit('message', Buffer.from(JSON.stringify({ type: 'session.updated' })));
	const connection = await connecting;
	const input = Buffer.alloc(12);
	[0, 100, 200, 300, 400, 500].forEach((value, index) => input.writeInt16LE(value, index * 2));
	await connection.appendAudio(input.subarray(0, 5).toString('base64'));
	await connection.appendAudio(input.subarray(5).toString('base64'));
	const output = Buffer.concat(
		socket.send.mock.calls
			.map(([frame]) => JSON.parse(frame))
			.filter((frame) => frame.type === 'input_audio_buffer.append')
			.map((frame) => Buffer.from(frame.audio, 'base64'))
	);
	expect(
		Array.from({ length: output.length / 2 }, (_, index) => output.readInt16LE(index * 2))
	).toEqual([0, 150, 300, 450]);
	await connection.stop();
});

it('keeps resampling phase invariant under packet segmentation', () => {
	const input = Buffer.alloc(2000);
	for (let index = 0; index < 1000; index += 1)
		input.writeInt16LE(Math.round(20000 * Math.sin(index / 13)), index * 2);
	const whole = createPcmResampler()(input);
	const stream = createPcmResampler();
	const chunks: Buffer[] = [];
	for (let offset = 0; offset < input.length; offset += 37)
		chunks.push(stream(input.subarray(offset, offset + 37)));
	expect(Buffer.concat(chunks)).toEqual(whole);
	expect(whole.length).toBe(1334);
});

it('rejects missing workspace settings before opening a socket', async () => {
	await expect(
		createQwenRealtimeVoiceAdapter(provider, socketFactory).connect(
			{ ...request, options: {} },
			jest.fn()
		)
	).rejects.toThrow('Workspace ID');
	expect(socketFactory).not.toHaveBeenCalled();
});

it('cancels an unfinished setup and closes its socket', async () => {
	const controller = new AbortController();
	const connecting = createQwenRealtimeVoiceAdapter(provider, socketFactory).connect(
		request,
		jest.fn(),
		controller.signal
	);
	controller.abort(new Error('Stopped'));
	await expect(connecting).rejects.toThrow('Stopped');
	expect(socket.close).toHaveBeenCalledWith(1000, 'Voice session stopped.');
});
