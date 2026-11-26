import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readRunInsights } from '../../../../src/main/agent/session/insights';
import { semanticRunEntry } from '../../../../src/main/agent/session/session_trace_entry';

const id = '528530b2-a683-4439-a035-598a61dcbe60';
const start = Date.UTC(2026, 0, 1);
let root: string;
let sessions: string;
let trace: string;

beforeEach(async () => {
	root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-insights-'));
	sessions = path.join(root, 'sessions');
	const folder = path.join(sessions, id);
	await mkdir(folder, { recursive: true });
	trace = path.join(folder, 'run.jsonl');
});
afterEach(async () => rm(root, { recursive: true, force: true }));

function row(offset: number, event: Record<string, unknown>): string {
	return JSON.stringify({ timestamp: new Date(start + offset).toISOString(), event: semanticRunEntry(event) });
}

it('reads only the selected reply and aggregates its model and tool steps', async () => {
	await writeFile(trace, [
		row(0, { type: 'run_started', runId: 'first' }),
		row(50, { type: 'run_finished', result: { numTurns: 0 } }),
		'broken row',
		row(1000, { type: 'run_started', runId: 'second', model: 'example' }),
		row(1030, { type: 'model_call_start' }),
		row(1130, { type: 'model_call_end', durationMs: 100, firstTokenLatencyMs: 40,
			usage: { inputTokens: 12, outputTokens: 2, cachedTokens: 5, costUsd: 0.5 } }),
		row(1131, { type: 'tool_call_start', toolCallId: 'a', toolName: 'read' }),
		row(1151, { type: 'tool_call_end', toolCallId: 'a' }),
		row(1170, { type: 'model_call_start' }),
		row(1270, { type: 'model_call_end', durationMs: 100, firstTokenLatencyMs: 15,
			usage: { inputTokens: 15, outputTokens: 6, cachedTokens: 9, costUsd: 0 } }),
		row(1280, { type: 'run_finished', result: { numTurns: 2, usage: { inputTokens: 27 } } }),
	].join('\n'));
	const result = await readRunInsights(sessions,id, 'second');
	expect(result).toEqual({
		turns: 2, firstTokenMs: 70, inputTokens: 27, outputTokens: 8, cachedTokens: 14, costUsd: 0.5,
		steps: [
			{ kind: 'model', name: 'example', offsetMs: 30, durationMs: 100 },
			{ kind: 'tool', name: 'read', offsetMs: 131, durationMs: 20 },
			{ kind: 'model', name: 'example', offsetMs: 170, durationMs: 100 },
		],
	});
	expect(await readRunInsights(sessions,id, start + 1260)).toEqual(result);
	expect(await readRunInsights(sessions,id, start + 70)).toBeNull();
});

it('keeps incomplete cost unknown and rejects ambiguous historical timestamps', async () => {
	await writeFile(trace, [
		row(0, { type: 'run_started', runId: 'one' }),
		row(30, { type: 'model_call_end', usage: { costUsd: 0.45 } }),
		row(60, { type: 'model_call_end', usage: { inputTokens: 15 } }),
		row(70, { type: 'run_finished', result: { numTurns: 2 } }),
		row(70, { type: 'run_started' }),
		row(100, { type: 'run_finished', result: { numTurns: 1 } }),
	].join('\n'));
	expect(await readRunInsights(sessions,id, 'one')).not.toHaveProperty('costUsd');
	expect(await readRunInsights(sessions,id, start + 70)).toBeNull();
	expect(await readRunInsights(sessions,id, start + 90)).toMatchObject({ turns: 1 });
});

it('returns unavailable for missing logs and rejects an invalid session id', async () => {
	expect(await readRunInsights(sessions,id, 'missing')).toBeNull();
	await expect(readRunInsights(sessions,'../outside', 'missing')).rejects.toThrow('Invalid assistant session id');
});
