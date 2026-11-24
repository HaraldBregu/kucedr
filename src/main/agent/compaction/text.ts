import type { Message } from '../types';

export function textContent(content: Message['content']): string {
	if (typeof content === 'string') return content;
	return content
		.filter(
			(block) => block.type === 'text' && typeof block.text === 'string' && block.internal !== true
		)
		.map((block) => String(block.text))
		.join('\n');
}
