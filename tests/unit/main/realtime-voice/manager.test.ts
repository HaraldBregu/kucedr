import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KeyedMutex } from '../../../../src/main/agent/mutex';
import type {
	RealtimeVoiceAdapterEventHandler,
	RealtimeVoiceAdapterRequest,
	RealtimeVoiceConnection,
} from '../../../../src/main/models/adapters/realtime_voice';
import { realtimeVoiceConversationFactory } from '../../../../src/main/agent/realtime_voice/conversation';
import {
	RealtimeVoiceManager,
	type ResolvedRealtimeVoiceConfiguration,
} from '../../../../src/main/agent/realtime_voice/manager';

class FakeConnection implements RealtimeVoiceConnection {
	readonly audio: string[] = [];
	readonly toolResults: Array<{ callId: string; output: string }> = [];
	interrupts = 0;
	stops = 0;
	append: (audio: string) => Promise<void> = async (audio) => {
		this.audio.push(audio);
	};

	appendAudio(audio: string): Promise<void> {
		return this.append(audio);
	}

	async interrupt(): Promise<void> {
		this.interrupts += 1;
	}

	async addToolResult(callId: string, output: string): Promise<void> {
		this.toolResults.push({ callId, output });
	}

	async stop(): Promise<void> {
		this.stops += 1;
	}
}

const configuration: ResolvedRealtimeVoiceConfiguration = {
	provider: {
		id: 'openai',
		name: 'OpenAI',
		apiKey: 'key',
		baseURL: 'https://api.openai.com/v1',
	},
	modelId: 'gpt-realtime-2.1',
	voice: 'marin',
	instructions: 'Help the user.',
	context: [],
	tools: [],
};

describe('RealtimeVoiceManager', () => {
	it('replaces voice markers with final user transcripts while streaming UI events', async () => {
		const connection = new FakeConnection();
		let adapterEmit: RealtimeVoiceAdapterEventHandler = () => undefined;
		const createAdapter = jest.fn(() => ({
			connect: async (
				_request: RealtimeVoiceAdapterRequest,
				emit: RealtimeVoiceAdapterEventHandler
			) => {
				adapterEmit = emit;
				return connection;
			},
		}));
		const events: Array<{ type: string; transcript?: string }> = [];
		const begunUserTurns: string[] = [];
		const finalizedUserTurns: Array<{ itemId: string; transcript: string }> = [];
		const assistantTurns: string[] = [];
		const manager = new RealtimeVoiceManager({
			createAdapter,
			resolveConfiguration: async () => configuration,
			createConversation: () => ({
				history: [],
				beginUserTurn: (itemId) => begunUserTurns.push(itemId),
				finalizeUserTurn: (itemId, transcript) => finalizedUserTurns.push({ itemId, transcript }),
				addAssistantTranscript: (text) => assistantTurns.push(text),
				addToolCall: () => undefined,
				addToolResult: () => undefined,
			}),
			resources: new KeyedMutex(),
			emit: (_windowId, event) => events.push(event),
		});

		const session = await manager.start(7, { chatSessionId: 'chat' });
		expect(createAdapter).toHaveBeenCalledWith(configuration.provider);
		adapterEmit({ type: 'input_speech_stopped', itemId: 'user-1' });
		adapterEmit({
			type: 'user_transcript_final',
			itemId: 'user-1',
			transcript: '  Show the message I sent.  ',
		});
		adapterEmit({
			type: 'user_transcript_final',
			itemId: 'user-1',
			transcript: 'Show the message I sent.',
		});
		adapterEmit({
			type: 'assistant_transcript_final',
			itemId: 'assistant-1',
			responseId: 'response-1',
			transcript: 'Hello there.',
		});
		adapterEmit({
			type: 'assistant_transcript_final',
			itemId: 'assistant-1',
			responseId: 'response-1',
			transcript: 'Hello there.',
		});

		expect(begunUserTurns).toEqual(['user-1']);
		expect(finalizedUserTurns).toEqual([
			{ itemId: 'user-1', transcript: 'Show the message I sent.' },
		]);
		expect(assistantTurns).toEqual(['Hello there.']);
		expect(events).toContainEqual({ type: 'user_turn', sessionId: session.id, itemId: 'user-1' });
		expect(events).toContainEqual({
			type: 'user_turn',
			sessionId: session.id,
			itemId: 'user-1',
			transcript: 'Show the message I sent.',
		});
	});

	it('bounds queued input while an adapter send is pending', async () => {
		const connection = new FakeConnection();
		let release = (): void => undefined;
		connection.append = () => new Promise<void>((resolve) => (release = resolve));
		const manager = new RealtimeVoiceManager({
			createAdapter: () => ({ connect: async () => connection }),
			resolveConfiguration: async () => configuration,
			createConversation: () => ({
				history: [],
				beginUserTurn: () => undefined,
				finalizeUserTurn: () => undefined,
				addAssistantTranscript: () => undefined,
				addToolCall: () => undefined,
				addToolResult: () => undefined,
			}),
			resources: new KeyedMutex(),
			emit: () => undefined,
		});
		const session = await manager.start(1, { chatSessionId: 'chat' });
		const first = manager.appendAudio(1, session.id, 'A'.repeat(150_000));
		expect(() => manager.appendAudio(1, session.id, 'A'.repeat(150_000))).toThrow('queue is full');
		await Promise.resolve();
		release();
		await first;
	});

	it('invalidates and closes a late connection when concurrent starts target one window', async () => {
		const pending: Array<{
			resolve(connection: RealtimeVoiceConnection): void;
			emit: RealtimeVoiceAdapterEventHandler;
		}> = [];
		const manager = new RealtimeVoiceManager({
			createAdapter: () => ({
				connect: (_request, emit) =>
					new Promise((resolve) => {
						pending.push({ resolve, emit });
					}),
			}),
			resolveConfiguration: async () => configuration,
			createConversation: () => ({
				history: [],
				beginUserTurn: () => undefined,
				finalizeUserTurn: () => undefined,
				addAssistantTranscript: () => undefined,
				addToolCall: () => undefined,
				addToolResult: () => undefined,
			}),
			resources: new KeyedMutex(),
			emit: () => undefined,
		});

		const firstStart = manager.start(3, { chatSessionId: 'first' });
		for (let attempt = 0; attempt < 10 && pending.length < 1; attempt += 1) {
			await Promise.resolve();
		}
		const secondStart = manager.start(3, { chatSessionId: 'second' });
		for (let attempt = 0; attempt < 10 && pending.length < 2; attempt += 1) {
			await Promise.resolve();
		}
		expect(pending).toHaveLength(2);

		const lateFirst = new FakeConnection();
		const current = new FakeConnection();
		pending[0].resolve(lateFirst);
		pending[1].resolve(current);
		await expect(firstStart).rejects.toThrow('stopped during connection');
		const second = await secondStart;
		expect(lateFirst.stops).toBe(1);

		await manager.stop(3, second.id);
		expect(current.stops).toBe(1);
	});

	it('lets the latest invocation win when configurations resolve out of order', async () => {
		const resolvers: Array<(value: typeof configuration) => void> = [];
		const connections: FakeConnection[] = [];
		const manager = new RealtimeVoiceManager({
			createAdapter: () => ({
				connect: async () => {
					const connection = new FakeConnection();
					connections.push(connection);
					return connection;
				},
			}),
			resolveConfiguration: () => new Promise((resolve) => resolvers.push(resolve)),
			createConversation: () => ({
				history: [],
				beginUserTurn: () => undefined,
				finalizeUserTurn: () => undefined,
				addAssistantTranscript: () => undefined,
				addToolCall: () => undefined,
				addToolResult: () => undefined,
			}),
			resources: new KeyedMutex(),
			emit: () => undefined,
		});

		const first = manager.start(8, { chatSessionId: 'first' });
		const second = manager.start(8, { chatSessionId: 'second' });
		expect(resolvers).toHaveLength(2);
		resolvers[1](configuration);
		const current = await second;
		resolvers[0](configuration);
		await expect(first).rejects.toThrow('superseded');
		expect(connections).toHaveLength(1);

		await manager.stop(8, current.id);
	});

	it('invalidates a pending start when its window closes before configuration resolves', async () => {
		let resolveConfiguration = (_value: typeof configuration): void => undefined;
		const connect = jest.fn(async () => new FakeConnection());
		const manager = new RealtimeVoiceManager({
			createAdapter: () => ({ connect }),
			resolveConfiguration: () => new Promise((resolve) => (resolveConfiguration = resolve)),
			createConversation: () => ({
				history: [],
				beginUserTurn: () => undefined,
				finalizeUserTurn: () => undefined,
				addAssistantTranscript: () => undefined,
				addToolCall: () => undefined,
				addToolResult: () => undefined,
			}),
			resources: new KeyedMutex(),
			emit: () => undefined,
		});

		const starting = manager.start(9, { chatSessionId: 'chat' });
		await manager.stopWindow(9);
		resolveConfiguration(configuration);
		await expect(starting).rejects.toThrow('superseded');
		expect(connect).not.toHaveBeenCalled();
	});

	it('aborts adapter setup immediately when its window closes', async () => {
		let setupSignal: AbortSignal | undefined;
		const manager = new RealtimeVoiceManager({
			createAdapter: () => ({
				connect: (_request, _emit, signal) => {
					setupSignal = signal;
					return new Promise((_resolve, reject) => {
						signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
					});
				},
			}),
			resolveConfiguration: async () => configuration,
			createConversation: () => ({
				history: [],
				beginUserTurn: () => undefined,
				finalizeUserTurn: () => undefined,
				addAssistantTranscript: () => undefined,
				addToolCall: () => undefined,
				addToolResult: () => undefined,
			}),
			resources: new KeyedMutex(),
			emit: () => undefined,
		});

		const starting = manager.start(10, { chatSessionId: 'chat' });
		for (let attempt = 0; attempt < 10 && !setupSignal; attempt += 1) await Promise.resolve();
		await manager.stopWindow(10);

		expect(setupSignal?.aborted).toBe(true);
		await expect(starting).rejects.toThrow('stopped');
	});

	it('prepends transient context while starting a fresh voice session', async () => {
		const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-voice-manager-'));
		const requests: RealtimeVoiceAdapterRequest[] = [];
		const adapterEmits: RealtimeVoiceAdapterEventHandler[] = [];
		const context = [{ role: 'user' as const, text: 'Workspace profile and bootstrap.' }];
		const manager = new RealtimeVoiceManager({
			createAdapter: () => ({
				connect: async (request, emit) => {
					requests.push(request);
					adapterEmits.push(emit);
					return new FakeConnection();
				},
			}),
			resolveConfiguration: async () => ({ ...configuration, context }),
			createConversation: realtimeVoiceConversationFactory({
				location: path.join(temporaryRoot, 'agent'),
			}),
			resources: new KeyedMutex(),
			emit: () => undefined,
		});
		const firstChat = '11111111-1111-4111-8111-111111111111';
		const secondChat = '22222222-2222-4222-8222-222222222222';
		try {
			const first = await manager.start(11, { chatSessionId: firstChat });
			expect(requests[0].history).toEqual(context);
			adapterEmits[0]({ type: 'input_speech_stopped', itemId: 'user-1' });
			adapterEmits[0]({
				type: 'user_transcript_final',
				itemId: 'user-1',
				transcript: 'Remember this question.',
			});
			adapterEmits[0]({
				type: 'assistant_transcript_final',
				itemId: 'assistant-1',
				responseId: 'response-1',
				transcript: 'I will remember this answer.',
			});
			await manager.stop(11, first.id);

			const restarted = await manager.start(11, { chatSessionId: firstChat });
			expect(requests[1].history).toEqual(context);
			await manager.stop(11, restarted.id);

			const isolated = await manager.start(11, { chatSessionId: secondChat });
			expect(requests[2].history).toEqual(context);
			await manager.stop(11, isolated.id);
		} finally {
			await manager.stopAll();
			fs.rmSync(temporaryRoot, { recursive: true, force: true });
		}
	});
});

it('rejects late tool effects from a response interrupted before its first tool event', async () => {
	let emit: RealtimeVoiceAdapterEventHandler = () => undefined;
	const run = jest.fn(() => 'unexpected');
	const connection = new FakeConnection();
	const results: unknown[] = [];
	const manager = new RealtimeVoiceManager({
		createAdapter: () => ({
			connect: async (_request, handler) => {
				emit = handler;
				return connection;
			},
		}),
		resolveConfiguration: async () => ({
			...configuration,
			tools: [
				{
					id: 'probe',
					capability: { effects: ['read'] },
					name: 'Probe',
					description: 'Probe',
					schema: { type: 'object' },
					timeoutMs: 1000,
					maxOutputBytes: 1000,
					parseInput: (input) => input as Record<string, unknown>,
					run,
				},
			],
		}),
		createConversation: () => ({
			history: [],
			beginUserTurn: () => undefined,
			finalizeUserTurn: () => undefined,
			addAssistantTranscript: () => undefined,
			addToolCall: () => undefined,
			addToolResult: (call) => results.push(call.result),
		}),
		resources: new KeyedMutex(),
		emit: () => undefined,
	});
	const session = await manager.start(3, { chatSessionId: 'chat' });
	emit({ type: 'response_started', responseId: 'old' });
	await manager.interrupt(3, session.id);
	emit({
		type: 'tool_call',
		callId: 'late',
		itemId: 'late',
		responseId: 'old',
		name: 'probe',
		arguments: '{}',
	});
	await new Promise((resolve) => setImmediate(resolve));
	expect(run).not.toHaveBeenCalled();
	expect(results).toEqual([expect.objectContaining({ isError: true })]);
	expect(connection.toolResults).toEqual([]);
	await manager.stopAll();
});
