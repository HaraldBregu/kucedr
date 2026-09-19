import type { MemoryMessage } from '../../shared/memory_types';

export function snapshotMarkdown(
	sessionId: string,
	messages: readonly MemoryMessage[],
	date = new Date()
): string {
	const sections: string[] = [`# Session ${sessionId}`, '', `**Date:** ${date.toISOString()}`];
	for (const message of messages) {
		if (message.role !== 'user' && message.role !== 'assistant') continue;
		const text =
			typeof message.content === 'string'
				? message.content
				: Array.isArray(message.content)
					? message.content
							.filter(
								(block): block is { type: string; text: string; internal?: boolean } =>
									typeof block === 'object' &&
									block !== null &&
									'type' in block &&
									block.type === 'text' &&
									'text' in block &&
									typeof block.text === 'string' &&
									(!('internal' in block) || block.internal !== true)
							)
							.map((block) => block.text)
							.join('\n')
					: '';
		if (!text.trim()) continue;
		sections.push(
			'',
			`**${message.role === 'user' ? 'User' : 'Assistant'}:**`,
			...text.split('\n').map((line) => (line ? `> ${line}` : '>'))
		);
	}
	return `${sections.join('\n')}\n`;
}
