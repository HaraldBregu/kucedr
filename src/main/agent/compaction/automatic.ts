import type { KeyedLimiter } from '../limiter';
import { isInternalMessage } from '../runner/run_internal';
import { turnStart } from '../runner/run_turn_start';
import { persist } from '../session/session_persist';
import type { SessionState } from '../session/session_types';
import { projectHistory } from './projection';
import { retainedUser } from './retained';
import { summarize } from './summarize';

export async function autoCompact(
	state: SessionState,
	providerLimiter: KeyedLimiter | undefined,
	signal: AbortSignal
): Promise<{ summary: string; userIndex: number } | undefined> {
	const active = state.lease ? AbortSignal.any([signal, state.lease.signal]) : signal;
	active.throwIfAborted();
	const history = projectHistory(state.messages);
	const index = retainedUser(history, true);
	if (!index) return;
	const anchor = history[index];
	const start = turnStart(history, index);
	const prefix = history.slice(0, start);
	const summary = await summarize(prefix, state.id, providerLimiter, active);
	active.throwIfAborted();
	if (!summary || summary.length >= JSON.stringify(prefix).length) return;

	const position = state.messages.indexOf(anchor);
	if (position < 0 || state.messages.slice(position).some((message) => message.compaction)) return;
	const userIndex = state.messages.slice(0, position).filter(
		(message) => message.role === 'user' && !isInternalMessage(message)
	).length;
	anchor.compaction = { summary };
	try {
		if (!state.pendingMessages) persist(state);
	} catch (error) {
		delete anchor.compaction;
		throw error;
	}
	return { summary, userIndex };
}
