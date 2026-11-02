import type { Config, Message, MessageContentBlock } from '../types';
import type { PromptAttachmentBlock } from '../attachments';
import type { SessionInput, SessionCategory, SessionState } from './session_types';
import { loadMessagesBySessionId } from './session_load_messages_by_session_id';
import { persist } from './session_persist';
import { resolveSessionId } from './session_resolve_session_id';
import { sanitizeMessages } from './session_sanitize_messages';
import { sessionFolderName } from './session_session_folder_name';
import { sessionsRoot } from './session_sessions_root';
import { DEFAULT_CATEGORY } from './session_types';
import type { SessionCoordinator } from './coordinator';
import { messagesFilePath } from './session_messages_file_path';

export function init(
	state: SessionState,
	config: Config,
	input: SessionInput,
	category: SessionCategory = DEFAULT_CATEGORY,
	coordinator?: SessionCoordinator
): void {
	state.lease?.release();
	state.lease = undefined;
	state.pendingMessages = undefined;
	state.id = resolveSessionId(input.sessionId, config.location, category);
	state.category = category;
	state.folderName = sessionFolderName(state.id);
	state.sessionsPath = sessionsRoot(config.location);
	const storedMessages = loadMessagesBySessionId(state.id, config.location);
	const legacySessionId = input.legacySessionId ?? input.sessionId;
	const legacyMessages =
		legacySessionId && legacySessionId !== state.id && storedMessages.length === 0
			? loadMessagesBySessionId(legacySessionId, config.location)
			: [];
	state.messages = sanitizeMessages([
		...(storedMessages.length > 0 ? storedMessages : legacyMessages),
	]);
	if (coordinator) {
		state.lease = coordinator.open(messagesFilePath(state), state.messages);
		state.messages = state.lease.messages;
	}
	const additions = sanitizeMessages(input.messages ?? []);
	if (input.message || (input.files?.length ?? 0) > 0) {
		additions.push({ role: 'user', content: toUserContent(input.message, input.files ?? []) });
	}
	if (state.lease && input.deferPersist) {
		state.pendingMessages = additions;
		state.messages = [...state.lease.messages, ...additions];
	} else {
		state.messages.push(...additions);
	}
	state.model = input.model ?? 'default';
	state.maxTurns = input.maxTurns ?? input.maxIterations ?? 32;
	state.toolCalls = [];
	state.usage = { inputTokens: 0, outputTokens: 0 };
	state.numTurns = 0;
	state.finalText = '';
	state.stopReason = undefined;
	state.runTraceBuffer = [];
	if (!input.deferPersist) persist(state);
}

function toUserContent(message: string, files: PromptAttachmentBlock[]): Message['content'] {
	if (files.length === 0) return message;
	const blocks: MessageContentBlock[] = [];
	if (message) blocks.push({ type: 'text', text: message });
	blocks.push(...files);
	return blocks;
}
