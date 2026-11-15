import type { Message } from '../types';
import { runContextText, SECTION_BREAK, unchanged } from './session_add_run_context';

export function expandRunContext(dropped: readonly Message[], kept: readonly Message[]): Message[] {
	const lost = new Map<string, string>();
	for (const message of dropped)
		for (const section of runContextText(message)?.split(SECTION_BREAK) ?? []) {
			const header = section.split('\n', 1)[0];
			if (section !== unchanged(header)) lost.set(header, section);
		}
	return kept.map((message) => {
		const text = runContextText(message);
		if (text === undefined || lost.size === 0 || !Array.isArray(message.content)) return message;
		const expanded = text
			.split(SECTION_BREAK)
			.map((section) => {
				const header = section.split('\n', 1)[0];
				if (section !== unchanged(header)) {
					lost.delete(header);
					return section;
				}
				return lost.get(header) ?? section;
			})
			.join('\n\n');
		return {
			...message,
			content: message.content.map((block) =>
				block.runContext === true ? { ...block, text: expanded } : block
			),
		};
	});
}
