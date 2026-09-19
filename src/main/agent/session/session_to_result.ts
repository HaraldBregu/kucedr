import type { SessionResult, SessionResultSubtype } from './session_types';
import type { SessionState } from './session_types';

export function toResult(state: SessionState, subtype: SessionResultSubtype): SessionResult {
	return {
		text: state.finalText,
		model: state.model,
		toolCalls: state.toolCalls,
		numTurns: state.numTurns,
		subtype,
		sessionId: state.id,
		stopReason: subtype === 'success' ? (state.stopReason ?? 'end_turn') : state.stopReason,
		usage: state.usage,
	};
}
