import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KeyedMutex } from '../../../../src/main/agent/mutex';
import { respondToolPermission } from '../../../../src/main/agent/permissions';
import { loadMessagesBySessionId } from '../../../../src/main/agent/session/session_load_messages_by_session_id';
import { realtimeVoiceConversationFactory } from '../../../../src/main/agent/realtime_voice/conversation';
import { RealtimeVoiceToolRuntime } from '../../../../src/main/agent/realtime_voice/tool_runtime';
import type { RealtimeVoiceConnection } from '../../../../src/main/models/adapters/realtime_voice';

const CHAT_SESSION_ID = '11111111-1111-4111-8111-111111111111';

it('runs native Realtime function calls through the existing tool runner and emits normalized lifecycle events', async () => {
	const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-voice-tool-success-'));
	const location = path.join(temporaryRoot, 'agent');
	const conversation = realtimeVoiceConversationFactory({ location })(CHAT_SESSION_ID, 'model');
	const events: Array<Record<string, unknown>> = [];
	let settleResult = (): void => undefined;
	const resultAdded = new Promise<void>((resolve) => (settleResult = resolve));
	const connection: RealtimeVoiceConnection = {
		appendAudio: async () => undefined,
		interrupt: async () => undefined,
		stop: async () => undefined,
		addToolResult: async (callId, output) => {
			expect({ callId, output }).toEqual({ callId: 'call-1', output: 'hello' });
			settleResult();
		},
	};
	const runtime = new RealtimeVoiceToolRuntime({
		sessionId: 'voice-session',
		windowId: 4,
		tools: [
			{
				id: 'echo',
				capability: { effects: ['read'] },
				name: 'Echo',
				description: 'Echo input.',
				schema: { type: 'object' },
				timeoutMs: 1_000,
				maxOutputBytes: 1_000,
				parseInput: (input) => input as Record<string, unknown>,
				run: (input) => input.value,
			},
		],
		signal: new AbortController().signal,
		resources: new KeyedMutex(),
		conversation,
		connection: () => connection,
		emit: (event) => events.push(event),
		onThinking: () => undefined,
		onError: (error) => {
			throw error;
		},
	});
	try {
		runtime.handle({
			type: 'tool_call_start',
			callId: 'call-1',
			itemId: 'item-1',
			responseId: 'response-1',
			name: 'echo',
		});
		runtime.handle({
			type: 'tool_call_args_delta',
			callId: 'call-1',
			itemId: 'item-1',
			responseId: 'response-1',
			delta: '{"value":"hello"}',
		});
		runtime.handle({
			type: 'tool_call',
			callId: 'call-1',
			itemId: 'item-1',
			responseId: 'response-1',
			name: 'echo',
			arguments: '{"value":"hello"}',
		});
		await resultAdded;

		expect(events.map((event) => event.type)).toEqual([
			'tool_call_start',
			'tool_call_args_delta',
			'tool_call_input',
			'tool_call_result',
		]);
	expect(events.at(-1)).toMatchObject({
			sessionId: 'voice-session',
			agentId: 'main',
			runId: 'voice-session:response-1',
			toolCallId: 'call-1',
			toolName: 'echo',
			output: 'hello',
			outputText: 'hello',
			status: 'ok',
			});
		expect(loadMessagesBySessionId(conversation.persistenceSessionId!, location)).toEqual([
			expect.objectContaining({
				role: 'assistant',
				toolCalls: [
					{
						id: 'call-1',
						name: 'echo',
						args: { value: 'hello' },
						result: { content: 'hello' },
					},
				],
			}),
		]);
		const restored = realtimeVoiceConversationFactory({ location })(CHAT_SESSION_ID, 'model');
		expect(loadMessagesBySessionId(restored.persistenceSessionId!, location)).toEqual([]);
	} finally {
		fs.rmSync(temporaryRoot, { recursive: true, force: true });
	}
});

it('persists failed Realtime tool calls with their canonical input and error outcome', async () => {
	const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-voice-tool-error-'));
	const location = path.join(temporaryRoot, 'agent');
	const conversation = realtimeVoiceConversationFactory({ location })(CHAT_SESSION_ID, 'model');
	let resolveResult = (): void => undefined;
	const resultAdded = new Promise<void>((resolve) => (resolveResult = resolve));
	const runtime = new RealtimeVoiceToolRuntime({
		sessionId: 'voice-error',
		windowId: 5,
		tools: [
			{
				id: 'explode',
				capability: { effects: ['read'] },
				name: 'Explode',
				description: 'Fail.',
				schema: { type: 'object' },
				timeoutMs: 1_000,
				maxOutputBytes: 1_000,
				parseInput: (input) => ({ value: String(input.value) }),
				run: () => {
					throw new Error('boom');
				},
			},
		],
		signal: new AbortController().signal,
		resources: new KeyedMutex(),
		conversation,
		connection: () => ({
			appendAudio: async () => undefined,
			interrupt: async () => undefined,
			stop: async () => undefined,
			addToolResult: async () => resolveResult(),
		}),
		emit: () => undefined,
		onThinking: () => undefined,
		onError: (error) => {
			throw error;
		},
	});
	try {
		runtime.handle({
			type: 'tool_call',
			callId: 'call-error',
			itemId: 'item-error',
			responseId: 'response-error',
			name: 'explode',
			arguments: '{"value":42}',
		});
		await resultAdded;
		const call = loadMessagesBySessionId(conversation.persistenceSessionId!, location)[0].toolCalls?.[0];
		expect(call).toMatchObject({
			id: 'call-error',
			name: 'explode',
			args: { value: '42' },
			result: { isError: true },
		});
		expect(call?.result?.content).toContain("tool 'explode' failed: boom");
	} finally {
		fs.rmSync(temporaryRoot, { recursive: true, force: true });
	}
});

it('preserves the existing permission request identity and returns rejected tool status', async () => {
	const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-voice-tool-denied-'));
	const location = path.join(temporaryRoot, 'agent');
	const conversation = realtimeVoiceConversationFactory({ location })(CHAT_SESSION_ID, 'model');
	let resolvePermission = (_event: Record<string, unknown>): void => undefined;
	const permissionEvent = new Promise<Record<string, unknown>>(
		(resolve) => (resolvePermission = resolve)
	);
	let resolveResult = (_output: string): void => undefined;
	const toolResult = new Promise<string>((resolve) => (resolveResult = resolve));
	const runtime = new RealtimeVoiceToolRuntime({
		sessionId: 'voice-permission',
		windowId: 6,
		tools: [
			{
				id: 'write',
				capability: { effects: ['write'] },
				name: 'Write file',
				description: 'Write a file.',
				schema: { type: 'object' },
				timeoutMs: 1_000,
				maxOutputBytes: 1_000,
				parseInput: (input) => input as Record<string, unknown>,
				run: () => {
					throw new Error('Rejected tools must not run.');
				},
			},
		],
		signal: new AbortController().signal,
		resources: new KeyedMutex(),
		conversation,
		connection: () => ({
			appendAudio: async () => undefined,
			interrupt: async () => undefined,
			stop: async () => undefined,
			addToolResult: async (_callId, output) => resolveResult(output),
		}),
		emit: (event) => {
			if (event.type === 'tool_permission_request') resolvePermission(event);
		},
		onThinking: () => undefined,
		onError: (error) => {
			throw error;
		},
	});

	try {
		runtime.handle({
			type: 'tool_call',
			callId: 'call-permission',
			itemId: 'item-permission',
			responseId: 'response-permission',
			name: 'write',
			arguments: '{"path":"/etc/kucedr-test","content":"test"}',
		});
		const permission = await permissionEvent;
		expect(permission).toMatchObject({
			type: 'tool_permission_request',
			sessionId: 'voice-permission',
			runId: 'voice-permission:response-permission',
			toolCallId: 'call-permission',
			toolName: 'write',
			mode: 'ask',
		});
		expect(permission).toHaveProperty('approvalId');
		expect(permission).toHaveProperty('inputFingerprint');
		expect(permission).toHaveProperty('expiresAt');
		respondToolPermission(
			{
				approvalId: String(permission.approvalId),
				runId: 'voice-permission:response-permission',
				toolName: 'write',
				inputFingerprint: String(permission.inputFingerprint),
			},
			'reject',
			6
		);
		expect(await toolResult).toContain('permission denied');
		const call = loadMessagesBySessionId(conversation.persistenceSessionId!, location)[0].toolCalls?.[0];
		expect(call).toMatchObject({
			id: 'call-permission',
			name: 'write',
			args: { path: '/etc/kucedr-test', content: 'test' },
			result: { isError: true },
		});
		expect(call?.result?.content).toContain('permission denied');
	} finally {
		fs.rmSync(temporaryRoot, { recursive: true, force: true });
	}
});

it('keeps file-access memory isolated between realtime voice runs', () => {
	const dependencies = {
		windowId: 1,
		tools: [],
		signal: new AbortController().signal,
		resources: new KeyedMutex(),
		conversation: {
			addToolCall: () => undefined,
			addToolResult: () => undefined,
		},
		connection: () => undefined,
		emit: () => undefined,
		onThinking: () => undefined,
		onError: () => undefined,
	};
	const first = new RealtimeVoiceToolRuntime({ sessionId: 'first', ...dependencies });
	const second = new RealtimeVoiceToolRuntime({ sessionId: 'second', ...dependencies });
	type RuntimeAccess = {
		fileAccess: { readDirectories: Set<string>; createdFiles: Set<string> };
	};
	const firstAccess = (first as unknown as RuntimeAccess).fileAccess;
	const secondAccess = (second as unknown as RuntimeAccess).fileAccess;

	firstAccess.readDirectories.add('/private/first');
	firstAccess.createdFiles.add('/private/first/file.txt');

	expect(secondAccess.readDirectories).toEqual(new Set());
	expect(secondAccess.createdFiles).toEqual(new Set());
	expect(firstAccess).not.toBe(secondAccess);
});

it('cancels queued response actions while allowing a subsequent response', async () => {
	const executed: string[] = [];
	let started = (): void => undefined;
	const firstStarted = new Promise<void>((resolve) => {
		started = resolve;
	});
	const results: string[] = [];
	const runtime = new RealtimeVoiceToolRuntime({
		sessionId: 'voice',
		windowId: 1,
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
				run: async (input, signal) => {
					const value = String(input.value);
					executed.push(value);
					if (value === 'first') {
						started();
						await new Promise<void>((_resolve, reject) => {
							signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
						});
					}
					return value;
				},
			},
		],
		signal: new AbortController().signal,
		resources: new KeyedMutex(),
		conversation: { addToolCall: () => undefined, addToolResult: () => undefined },
		connection: () => ({
			appendAudio: async () => undefined,
			interrupt: async () => undefined,
			stop: async () => undefined,
			addToolResult: async (_id, text) => {
				results.push(text);
			},
		}),
		emit: () => undefined,
		onThinking: () => undefined,
		onError: (error) => {
			throw error;
		},
	});
	for (const value of ['first', 'second'])
		runtime.handle({
			type: 'tool_call',
			callId: value,
			itemId: value,
			responseId: 'old',
			name: 'probe',
			arguments: JSON.stringify({ value }),
		});
	await firstStarted;
	runtime.interrupt();
	runtime.handle({
		type: 'tool_call',
		callId: 'third',
		itemId: 'third',
		responseId: 'new',
		name: 'probe',
		arguments: '{"value":"third"}',
	});
	await new Promise((resolve) => setImmediate(resolve));
	expect(executed).toEqual(['first', 'third']);
	expect(results).toEqual(['third']);
});

it('denies the next action before execution after its output budget is exhausted', async () => {
	let executed = 0;
	const results: string[] = [];
	const runtime = new RealtimeVoiceToolRuntime({
		sessionId: 'voice',
		windowId: 1,
		tools: [
			{
				id: 'probe',
				capability: { effects: ['read'] },
				name: 'Probe',
				description: 'Probe',
				schema: { type: 'object' },
				timeoutMs: 1000,
				maxOutputBytes: 1_100_000,
				parseInput: (input) => input as Record<string, unknown>,
				run: () => {
					executed += 1;
					return 'x'.repeat(1_000_000);
				},
			},
		],
		signal: new AbortController().signal,
		resources: new KeyedMutex(),
		conversation: { addToolCall: () => undefined, addToolResult: () => undefined },
		connection: () => ({
			appendAudio: async () => undefined,
			interrupt: async () => undefined,
			stop: async () => undefined,
			addToolResult: async (_id, text) => {
				results.push(text);
			},
		}),
		emit: () => undefined,
		onThinking: () => undefined,
		onError: (error) => {
			throw error;
		},
	});
	for (let index = 0; index < 4; index += 1)
		runtime.handle({
			type: 'tool_call',
			callId: String(index),
			itemId: String(index),
			responseId: 'response',
			name: 'probe',
			arguments: '{}',
		});
	await new Promise((resolve) => setImmediate(resolve));
	expect(executed).toBe(3);
	expect(results).toHaveLength(4);
	expect(results[3]).toContain('budget exhausted');
});

it('invalidates pending response approvals on interruption', async () => {
	const run = jest.fn(() => 'unexpected');
	let requested = (_event: Record<string, unknown>): void => undefined;
	const permission = new Promise<Record<string, unknown>>((resolve) => {
		requested = resolve;
	});
	const completed: unknown[] = [];
	const runtime = new RealtimeVoiceToolRuntime({
		sessionId: 'voice-cancel-approval',
		windowId: 7,
		tools: [
			{
				id: 'external_probe',
				name: 'Probe',
				description: 'Probe',
				schema: { type: 'object' },
				timeoutMs: 1000,
				maxOutputBytes: 1000,
				capability: { effects: ['external'], approval: true },
				parseInput: (input) => input as Record<string, unknown>,
				run,
			},
		],
		signal: new AbortController().signal,
		resources: new KeyedMutex(),
		conversation: {
			addToolCall: () => undefined,
			addToolResult: (call) => {
				completed.push(call.result);
			},
		},
		connection: () => ({
			appendAudio: async () => undefined,
			interrupt: async () => undefined,
			stop: async () => undefined,
			addToolResult: async () => undefined,
		}),
		emit: (event) => {
			if (event.type === 'tool_permission_request') requested(event);
		},
		onThinking: () => undefined,
		onError: (error) => {
			throw error;
		},
	});
	runtime.handle({
		type: 'tool_call',
		callId: 'approval',
		itemId: 'approval',
		responseId: 'old',
		name: 'external_probe',
		arguments: '{}',
	});
	const event = await permission;
	runtime.interrupt();
	await new Promise((resolve) => setImmediate(resolve));
	expect(run).not.toHaveBeenCalled();
	expect(completed).toEqual([expect.objectContaining({ isError: true })]);
	expect(
		respondToolPermission(
			{
				approvalId: String(event.approvalId),
				runId: String(event.runId),
				toolName: String(event.toolName),
				inputFingerprint: String(event.inputFingerprint),
			},
			'approve',
			7
		)
	).toBe(false);
});
