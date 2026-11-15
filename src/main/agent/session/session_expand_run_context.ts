import type { Message } from '../types';
import { runContextText, SECTION_BREAK, unchanged } from './session_add_run_context';

export function expandRunContext(dropped: readonly Message[], kept: Message[]): Message[] {
	const full = new Map<string, string>();
	const collect = (text: string) => {
		for (const section of text.split(SECTION_BREAK)) {
			const header = section.split('\n', 1)[0];
			if (section !== unchanged(header)) full.set(header, section);
		}
	};
	for (const message of dropped) {
		const text = runContextText(message);
		if (text !== undefined) collect(text);
	}
	return kept.map((message) => {
		const text = runContextText(message);
		if (text === undefined || !Array.isArray(message.content)) return message;
		const expanded = text
			.split(SECTION_BREAK)
			.map((section) => {
				const header = section.split('\n', 1)[0];
				return section === unchanged(header) ? (full.get(header) ?? section) : section;
			})
			.join('\n\n');
		collect(text);
		return {
			...message,
			content: message.content.map((block) =>
				block.runContext === true ? { ...block, text: expanded } : block
			),
		};
	});
}
