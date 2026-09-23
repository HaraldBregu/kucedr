import type { Message } from '../types';
import { isMessageContent } from './session_is_message_content';
import { isRecord } from './session_is_record';
import { isToolCall } from './session_is_tool_call';

export function isMessage(value: unknown): value is Message {
	if (!isRecord(value)) return false;
	if (
		value.role !== 'system' &&
		value.role !== 'user' &&
		value.role !== 'assistant' &&
		value.role !== 'summary'
	)
		return false;
	if (!isMessageContent(value.content)) return false;
	if (value.toolCalls !== undefined) {
		if (!Array.isArray(value.toolCalls)) return false;
		if (!value.toolCalls.every(isToolCall)) return false;
	}
	return true;
}
