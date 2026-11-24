import type { Message } from '../types';
import { textContent } from './text';

export function transcriptLine(message: Message): string {
	const content = textContent(message.content);
	if (message.role === 'assistant') {
		const tools = (message.toolCalls ?? []).map((call) =>
			`Tool ${call.name}: ${call.result ? textContent(call.result.content) : ''}`
		);
		return [content ? `Assistant: ${content}` : '', ...tools].filter(Boolean).join('\n');
	}
	if (!content) return '';
	if (message.role === 'summary') return `Earlier summary:
${content}`;
	if (message.role === 'user') return `User: ${content}`;
	return '';
}
