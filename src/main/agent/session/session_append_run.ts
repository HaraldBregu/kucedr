import { appendFileSync } from 'node:fs';
import type { SessionState } from './session_types';
import { ensureSession } from './session_ensure_session';
import { runFilePath } from './session_run_file_path';
import { stringifyRunEntry } from './session_stringify_run_entry';
import { mcpTraceEntry } from './session_mcp_trace';

const TRACE_BUFFER_SIZE = 16;

export function appendRun(state: SessionState, entry: unknown): void {
	if (!state.sessionsPath || (state.lease && !state.lease.active)) return;
	const finalMcpEntry = mcpTraceEntry(state, entry);
	if (finalMcpEntry) {
		const serializedMcp = stringifyRunEntry(finalMcpEntry);
		if (serializedMcp) state.runTraceBuffer.push(serializedMcp);
	}
	const serialized = stringifyRunEntry(entry);
	if (!serialized) return;
	state.runTraceBuffer.push(serialized);
	const terminal =
		entry !== null &&
		typeof entry === 'object' &&
		!Array.isArray(entry) &&
		['run_finished', 'run_error'].includes(String((entry as Record<string, unknown>).type));
	if (!terminal && state.runTraceBuffer.length < TRACE_BUFFER_SIZE) return;
	ensureSession(state);
	appendFileSync(runFilePath(state), `${state.runTraceBuffer.join('\n')}\n`, 'utf8');
	state.runTraceBuffer = [];
}
