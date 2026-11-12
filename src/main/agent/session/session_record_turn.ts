import type { SessionTurn } from './session_types';
import type { SessionState } from './session_types';

export function recordTurn(state: SessionState, turn: SessionTurn): void {
	state.numTurns += 1;
	state.model = turn.model;
	state.stopReason = turn.stopReason;
	state.usage.inputTokens += turn.usage?.inputTokens ?? 0;
	state.usage.outputTokens += turn.usage?.outputTokens ?? 0;
	if (turn.usage?.cachedTokens !== undefined)
		state.usage.cachedTokens = (state.usage.cachedTokens ?? 0) + turn.usage.cachedTokens;
	if (turn.usage?.cacheWriteTokens !== undefined)
		state.usage.cacheWriteTokens =
			(state.usage.cacheWriteTokens ?? 0) + turn.usage.cacheWriteTokens;
	if (turn.content) state.finalText = turn.content;
}
