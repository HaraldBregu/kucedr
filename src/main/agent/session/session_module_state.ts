import { createRunContext } from '../context';
import { DEFAULT_CATEGORY, type SessionState } from './session_types';

export function createSessionState(): SessionState {
	return {
		id: '',
		category: DEFAULT_CATEGORY,
		messages: [],
		toolCalls: [],
		usage: { inputTokens: 0, outputTokens: 0 },
		maxTurns: 32,
		model: 'default',
		numTurns: 0,
		finalText: '',
		sessionsPath: '',
		folderName: '',
		runTraceBuffer: [],
		runContext: createRunContext(),
	};
}
