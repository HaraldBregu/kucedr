import { isExhausted } from '../../../../../src/main/agent/session/session_is_exhausted';
import { toResult } from '../../../../../src/main/agent/session/session_to_result';
import { stringifyRunEntry } from '../../../../../src/main/agent/session/session_stringify_run_entry';
import { createSessionState } from '../../../../../src/main/agent/session/session_module_state';

describe('isExhausted', () => {
	it('is true when numTurns reaches maxTurns', () => {
		expect(isExhausted({ ...createSessionState(), numTurns: 20, maxTurns: 20 })).toBe(true);
		expect(isExhausted({ ...createSessionState(), numTurns: 21, maxTurns: 20 })).toBe(true);
	});
	it('is false while turns remain', () => {
		expect(isExhausted({ ...createSessionState(), numTurns: 5, maxTurns: 20 })).toBe(false);
	});
});

describe('toResult', () => {
	const base = {
		...createSessionState(),
		id: 'sid',
		model: 'm1',
		finalText: 'answer',
		numTurns: 3,
		toolCalls: [{ id: '1', name: 'n', args: {} }],
		usage: { inputTokens: 10, outputTokens: 20 },
		stopReason: 'end_turn',
	};

	it('maps a successful run', () => {
		const r = toResult(base, 'success');
		expect(r).toMatchObject({
			text: 'answer',
			model: 'm1',
			numTurns: 3,
			subtype: 'success',
			sessionId: 'sid',
			stopReason: 'end_turn',
			usage: { inputTokens: 10, outputTokens: 20 },
		});
		expect(r.toolCalls).toHaveLength(1);
	});

	it('defaults stopReason to end_turn on success when unset', () => {
		expect(toResult({ ...base, stopReason: undefined }, 'success').stopReason).toBe('end_turn');
	});

	it('preserves the final explanation and stopReason on error', () => {
		const r = toResult({ ...base, stopReason: 'max' }, 'error_max_turns');
		expect(r.text).toBe('answer');
		expect(r.subtype).toBe('error_max_turns');
		expect(r.stopReason).toBe('max');
	});
});

describe('stringifyRunEntry', () => {
	it('wraps an event with a timestamp', () => {
		const parsed = JSON.parse(stringifyRunEntry({ type: 'x' })!);
		expect(parsed.event).toEqual({ type: 'x' });
		expect(typeof parsed.timestamp).toBe('string');
	});
	it('replaces invalid events without serializing their payload', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		const parsed = JSON.parse(stringifyRunEntry(circular)!);
		expect(parsed.event).toEqual({ type: 'invalid_event' });
	});
	it('omits raw deltas and provider payloads', () => {
		expect(
			stringifyRunEntry({ type: 'model_call_delta', delta: 'private answer' })
		).toBeUndefined();
		expect(
			stringifyRunEntry({ type: 'model_provider_item', item: { secret: 'provider payload' } })
		).toBeUndefined();
	});
	it('keeps semantic tool timing without input or output payloads', () => {
		const serialized = stringifyRunEntry({
			type: 'tool_call_end',
			toolCallId: 'call-1',
			toolName: 'exec',
			input: { token: 'secret-input' },
			output: 'secret-output',
			isError: false,
			durationMs: 12,
		});
		expect(serialized).not.toContain('secret-input');
		expect(serialized).not.toContain('secret-output');
		expect(JSON.parse(serialized!).event).toEqual({
			type: 'tool_call_end',
			toolCallId: 'call-1',
			toolName: 'exec',
			isError: false,
			durationMs: 12,
		});
	});
	it('keeps queue, model, retry, and permission metrics without content', () => {
		expect(
			JSON.parse(stringifyRunEntry({ type: 'run_queue_metrics', queueDelayMs: 7 })!).event
		).toEqual({ type: 'run_queue_metrics', queueDelayMs: 7 });
		expect(
			JSON.parse(
				stringifyRunEntry({
					type: 'provider_queue_metrics',
					providerId: 'openai',
					queueDelayMs: 9,
					attempt: 1,
					prompt: 'private',
				})!
			).event
		).toEqual({
			type: 'provider_queue_metrics',
			providerId: 'openai',
			queueDelayMs: 9,
			attempt: 1,
		});
		expect(
			JSON.parse(
				stringifyRunEntry({
					type: 'model_call_end',
					model: 'model',
					durationMs: 42,
					firstTokenLatencyMs: 8,
					retryCount: 1,
				})!
			).event
		).toMatchObject({ durationMs: 42, firstTokenLatencyMs: 8, retryCount: 1 });
		expect(
			JSON.parse(
				stringifyRunEntry({
					type: 'tool_call_end',
					toolName: 'web_fetch',
					permissionOutcome: 'approve',
					input: { token: 'private' },
				})!
			).event
		).toEqual({ type: 'tool_call_end', toolName: 'web_fetch', permissionOutcome: 'approve' });
	});
	it('records skill activation identity and hash without instruction content', () => {
		const started = stringifyRunEntry({
			type: 'run_started',
			tools: ['read'],
			skillDiagnostics: [{ level: 'error', code: 'invalid', message: 'private path' }],
			skillActivations: [{ id: 'writer', name: 'writer', hash: 'abc', trust: 'user-controlled' }],
		});
		expect(JSON.parse(started!).event).toMatchObject({
			skillDiagnosticCount: 1,
			skillActivations: [{ id: 'writer', name: 'writer', hash: 'abc', trust: 'user-controlled' }],
		});
		expect(started).not.toContain('private path');

		const loaded = stringifyRunEntry({
			type: 'tool_call_end',
			toolName: 'load_skill',
			output: { activated: true, id: 'writer', hash: 'abc', instructions: 'private body' },
		});
		expect(JSON.parse(loaded!).event.skillActivation).toEqual({ id: 'writer', hash: 'abc' });
		expect(loaded).not.toContain('private body');
	});
});
