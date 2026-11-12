import type { Message } from '../types';

export function attachRunContext(messages: Message[], index: number, context: string): Message[] {
	const message = messages[index];
	if (!message || !context) return messages;
	const content =
		typeof message.content === 'string'
			? [{ type: 'text', text: message.content }]
			: message.content;
	const attached = [...messages];
	attached[index] = { ...message, content: [{ type: 'text', text: context }, ...content] };
	return attached;
}
