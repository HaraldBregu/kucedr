import type {
	AgentHistoryMessage,
	AgentResponseEvent,
} from '@/lib/compat';

export type AgentChatAction =
	| {
			type: 'submit_user_message';
			userMessageId: string;
			agentMessageId: string;
			content: string;
			submittedAtMs?: number;
	  }
	| { type: 'append_user_message'; messageId: string; content: string }
	| { type: 'update_user_message'; messageId: string; content: string }
	| {
			type: 'resubmit_user_message';
			messageId: string;
			content: string;
			agentMessageId: string;
			submittedAtMs?: number;
	  }
	| {
			type: 'start_voice_turn';
			userMessageId: string;
			agentMessageId: string;
			runId: string;
			content: string;
			startedAtMs: number;
	  }
	| { type: 'apply_response_event'; event: AgentResponseEvent; receivedAtMs: number }
	| { type: 'complete_active'; response: string; completedAtMs?: number }
	| { type: 'cancel_active'; completedAtMs?: number }
	| { type: 'error_active'; errorText: string; completedAtMs?: number }
	| { type: 'restore_history'; history: AgentHistoryMessage[] }
	| { type: 'reset' };
