import { open } from 'node:fs/promises';
import type { AgentRunInsights } from '../../../shared/agent_types';
import { sessionPath } from './session_session_path';
import { summarizeRun, type TimedRunEvent } from './summarize';

export async function readRunInsights(
	root: string,
	sessionId: string,
	selector: string | number,
): Promise<AgentRunInsights | null> {
	const file = sessionPath(root, sessionId, 'run.jsonl');
	const handle = await open(file, 'r').catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (!handle) return null;

	let events: TimedRunEvent[] | undefined;
	let match: AgentRunInsights | null = null;
	const lines = handle.readLines({ autoClose: false });
	try {
		for await (const line of lines) {
			let row;
			try {
				row = JSON.parse(unsealLine(line));
			} catch {
				continue;
			}
			const event = row?.event;
			const time = Date.parse(row?.timestamp);
			if (typeof event?.type !== 'string' || !Number.isFinite(time)) continue;
			if (event.type === 'run_started') {
				const selected = typeof selector === 'string' ? event.runId === selector : time <= selector;
				events = selected ? [{ time, event }] : undefined;
				continue;
			}
			if (!events) continue;
			if (['model_call_start', 'model_call_end', 'tool_call_start', 'tool_call_end'].includes(event.type)) {
				events.push({ time, event });
			} else if (event.type === 'run_finished') {
				const terminal = event.result ?? event;
				if (typeof selector === 'string') return summarizeRun(events, terminal);
				if (selector <= time) {
					if (match) return null;
					match = summarizeRun(events, terminal);
				}
				events = undefined;
			}
		}
		return match;
	} finally {
		lines.close();
		await handle.close();
	}
}
